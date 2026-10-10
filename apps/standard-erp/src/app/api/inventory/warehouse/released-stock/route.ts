import { parseStockGrade, parseStockKind, prisma, queryReleasedLotBalance, resolveStockKind } from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'

/** GC assay % from RM QC logs for a receipt (Lot / GRN). */
function purityFromQcLogs(
  logs: Array<{ instrument: { type: string }; payload: unknown }>,
): number | null {
  for (const log of logs) {
    if (log.instrument.type !== 'gc') continue
    const payload =
      log.payload && typeof log.payload === 'object'
        ? (log.payload as Record<string, unknown>)
        : {}
    const pct = Number(payload.percentage)
    if (Number.isFinite(pct)) return pct
  }
  return null
}

/**
 * Plant / released stock: Lot/GRN balances from warehouse issue releases minus
 * posted production consumption. Used by chemist production pickers.
 * Rejected SFG lots are excluded unless stock_grade=rejected (SFG→FG later).
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner', 'warehouse_manager', 'chemist'])
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    const material = searchParams.get('material_type')?.trim()
    const gradeParam = searchParams.get('stock_grade')?.trim()
    const stockKind = parseStockKind(searchParams.get('stock_kind'), 'rm')
    if (stockKind === 'fg' || stockKind === 'byproduct') {
      return NextResponse.json({ success: true, stock: [] })
    }
    const includeRejected = gradeParam === 'rejected'
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const balances = await queryReleasedLotBalance({
      factoryId,
      materialType: material || undefined,
    })
    const rows = balances.filter((b) => b.qty_remaining > 1e-9)

    const invoiceNumbers = rows.map((r) => r.invoice_number)
    const metaByInvoice = new Map(
      (
        invoiceNumbers.length === 0
          ? []
          : await prisma.stockEntry.findMany({
              where: { factoryId, invoiceNumber: { in: invoiceNumbers } },
              select: {
                invoiceNumber: true,
                supplierName: true,
                entryDate: true,
                stockGrade: true,
                stockKind: true,
              },
            })
      ).map((s) => [s.invoiceNumber, s]),
    )

    const receipts =
      invoiceNumbers.length === 0
        ? []
        : await prisma.procurementReceipt.findMany({
            where: { factoryId, receiptNumber: { in: invoiceNumbers } },
            select: { id: true, receiptNumber: true },
          })
    const receiptIdByLot = new Map(receipts.map((r) => [r.receiptNumber, r.id]))
    const receiptIds = receipts.map((r) => r.id)

    const qcLogs =
      receiptIds.length === 0
        ? []
        : await prisma.qcLogEntry.findMany({
            where: { factoryId, stage: 'rm', subjectId: { in: receiptIds } },
            select: {
              subjectId: true,
              payload: true,
              instrument: { select: { type: true } },
            },
            orderBy: { createdAt: 'desc' },
          })

    const logsByReceipt = new Map<string, typeof qcLogs>()
    for (const log of qcLogs) {
      const list = logsByReceipt.get(log.subjectId) ?? []
      list.push(log)
      logsByReceipt.set(log.subjectId, list)
    }

    const purityByLot = new Map<string, number | null>()
    for (const [lot, receiptId] of receiptIdByLot) {
      purityByLot.set(lot, purityFromQcLogs(logsByReceipt.get(receiptId) ?? []))
    }

    const visibleRows = rows.filter((b) => {
      const meta = metaByInvoice.get(b.invoice_number)
      const kind = resolveStockKind(meta?.stockKind, b.invoice_number)
      if (kind !== stockKind) return false
      const grade = parseStockGrade(meta?.stockGrade)
      if (stockKind === 'sfg' && !gradeParam) return true
      return includeRejected ? grade === 'rejected' : grade !== 'rejected'
    })

    const stock = visibleRows.map((b) => {
      const meta = metaByInvoice.get(b.invoice_number)
      return {
        factory_id: b.factory_id,
        invoice_number: b.invoice_number,
        material_type: b.material_type,
        tons_loaded: b.qty_released,
        tons_used: b.qty_consumed,
        tons_remaining: b.qty_remaining,
        qty_released: b.qty_released,
        qty_consumed: b.qty_consumed,
        entry_date: meta?.entryDate
          ? new Date(meta.entryDate).toISOString().slice(0, 10)
          : null,
        supplier_name: meta?.supplierName ?? null,
        purity: purityByLot.get(b.invoice_number) ?? null,
        stock_grade: parseStockGrade(meta?.stockGrade),
        stock_kind: resolveStockKind(meta?.stockKind, b.invoice_number),
      }
    })

    return NextResponse.json({ success: true, stock })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
