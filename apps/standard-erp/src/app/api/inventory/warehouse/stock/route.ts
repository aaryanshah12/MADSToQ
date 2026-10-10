import { compareNaturalDesc, parsePageParams, prisma, queryStockBalance, parseStockGrade, parseStockKind } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'
import { purityFromGcLogs } from '@/lib/production-fg-stock'

async function loadWarehouseLotQc(factoryId: string) {
  const qcSelect = {
    subjectId: true,
    payload: true,
    instrument: { select: { type: true } },
  } as const
  const [receipts, fgBatches] = await Promise.all([
    prisma.procurementReceipt.findMany({
      where: { factoryId },
      select: { id: true, receiptNumber: true },
    }),
    prisma.productionBatch.findMany({
      where: { factoryId },
      select: {
        id: true,
        batchNo: true,
        mfgDate: true,
        purity: true,
        creator: { select: { fullName: true } },
      },
    }),
  ])
  const receiptIdByLot = new Map(receipts.map((r) => [r.receiptNumber, r.id]))
  const fgByLot = new Map(fgBatches.map((b) => [b.batchNo, b]))
  const [qcLogs, fgQcLogs] = await Promise.all([
    receipts.length === 0
      ? Promise.resolve([])
      : prisma.qcLogEntry.findMany({
          where: { factoryId, stage: 'rm', subjectId: { in: receipts.map((r) => r.id) } },
          select: qcSelect,
          orderBy: { createdAt: 'desc' },
        }),
    fgBatches.length === 0
      ? Promise.resolve([])
      : prisma.qcLogEntry.findMany({
          where: {
            factoryId,
            stage: { in: ['sfg', 'fg'] },
            subjectId: { in: fgBatches.map((b) => b.id) },
          },
          select: qcSelect,
          orderBy: { createdAt: 'desc' },
        }),
  ])
  const logsByReceipt = new Map<string, typeof qcLogs>()
  for (const log of qcLogs) {
    const list = logsByReceipt.get(log.subjectId) ?? []
    list.push(log)
    logsByReceipt.set(log.subjectId, list)
  }
  const purityByLot = new Map<string, number | null>()
  for (const [lot, receiptId] of receiptIdByLot) {
    purityByLot.set(lot, purityFromGcLogs(logsByReceipt.get(receiptId) ?? []))
  }
  const fgLogsByBatch = new Map<string, typeof fgQcLogs>()
  for (const log of fgQcLogs) {
    const list = fgLogsByBatch.get(log.subjectId) ?? []
    list.push(log)
    fgLogsByBatch.set(log.subjectId, list)
  }
  const fgPurityByLot = new Map<string, number | null>()
  for (const b of fgBatches) {
    const fromLab = purityFromGcLogs(fgLogsByBatch.get(b.id) ?? [])
    const stored = b.purity == null ? null : Number(b.purity)
    fgPurityByLot.set(b.batchNo, fromLab ?? stored)
  }
  return { purityByLot, fgByLot, fgPurityByLot }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    const material = searchParams.get('material_type')?.trim()
    const gradeParam = searchParams.get('stock_grade')?.trim()
    const kindParam = searchParams.get('stock_kind')?.trim()
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const balancePromise = queryStockBalance({ factoryIds: [factoryId] })
    const qcPromise = loadWarehouseLotQc(factoryId)
    const auth = await requireProfile(request, [
      'owner',
      'warehouse_manager',
      'chemist',
      'lab_incharge',
    ])
    if (auth.error) return auth.error

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const [balances, lotQc] = await Promise.all([balancePromise, qcPromise])
    let rows = balances.filter((b) => b.tons_remaining > 1e-9)
    if (material) {
      const lower = material.toLowerCase()
      rows = rows.filter((b) => b.material_type.toLowerCase() === lower)
    }
    if (kindParam === 'rm' || kindParam === 'sfg' || kindParam === 'fg' || kindParam === 'byproduct') {
      const kind = parseStockKind(kindParam)
      rows = rows.filter((b) => parseStockKind(b.stock_kind) === kind)
    }
    if (gradeParam === 'approved' || gradeParam === 'rejected') {
      const grade = parseStockGrade(gradeParam)
      rows = rows.filter((b) => parseStockGrade(b.stock_grade) === grade)
    }
    const q = searchParams.get('q')?.trim().toLowerCase()
    if (q) {
      rows = rows.filter((b) =>
        b.invoice_number.toLowerCase().includes(q) ||
        b.material_type.toLowerCase().includes(q) ||
        (b.supplier_name ?? '').toLowerCase().includes(q),
      )
    }
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (from || to) {
      rows = rows.filter((b) => {
        const day = b.entry_date ? new Date(b.entry_date).toISOString().slice(0, 10) : ''
        if (!day) return false
        if (from && day < from) return false
        if (to && day > to) return false
        return true
      })
    }
    rows.sort((a, b) => compareNaturalDesc(a.invoice_number, b.invoice_number))
    const total = rows.length
    const page = parsePageParams(searchParams)
    if (!page.all) {
      const start = (page.page - 1) * page.pageSize
      rows = rows.slice(start, start + page.pageSize)
    }

    const { purityByLot, fgByLot, fgPurityByLot } = lotQc

    const stock = rows
      .map((b) => {
        const parentNo = (() => {
          const i = b.invoice_number.indexOf('/BP/')
          return i >= 0 ? b.invoice_number.slice(0, i) : b.invoice_number
        })()
        const isBp = b.invoice_number.includes('/BP/')
        const fg = fgByLot.get(parentNo)
        const fgPurity = isBp ? null : fgPurityByLot.get(parentNo) ?? null
        return {
          factory_id: b.factory_id,
          invoice_number: b.invoice_number,
          material_type: b.material_type,
          tons_loaded: b.tons_loaded,
          tons_used: b.tons_used,
          tons_remaining: b.tons_remaining,
          entry_date: b.entry_date
            ? new Date(b.entry_date).toISOString().slice(0, 10)
            : fg?.mfgDate
              ? fg.mfgDate.toISOString().slice(0, 10)
              : null,
          supplier_name: b.supplier_name ?? null,
          purity: fgPurity ?? purityByLot.get(b.invoice_number) ?? null,
          mfg_date: fg?.mfgDate ? fg.mfgDate.toISOString().slice(0, 10) : null,
          chemist_name: fg?.creator?.fullName ?? null,
          source: fg ? 'production' : 'procurement',
          stock_grade: parseStockGrade(b.stock_grade),
          stock_kind: parseStockKind(b.stock_kind),
          is_byproduct: isBp || parseStockKind(b.stock_kind) === 'byproduct',
        }
      })
      .sort((a, b) => a.material_type.localeCompare(b.material_type))

    return NextResponse.json({
      success: true,
      stock,
      total,
      page: page.page,
      pageSize: page.all ? total : page.pageSize,
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
