import {
  createUsageFromLot,
  getInvoiceRemaining,
  loadPage,
  parsePageParams,
  parseStockGrade,
  parseStockKind,
  prisma,
  serializeWarehouseIssueRelease,
  serializeWarehouseIssueRequest,
  UsageLotError,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'

type ReleaseLine = { invoice_number: string; qty: number }

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

export async function GET(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['owner', 'warehouse_manager', 'chemist'])
    if (auth.error) return auth.error

    const { searchParams } = new URL(request.url)
    const factoryId = searchParams.get('factory_id')
    const requestId = searchParams.get('request_id')
    if (!factoryId) {
      return NextResponse.json({ error: 'factory_id is required' }, { status: 400 })
    }

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const where = {
      request: {
        factoryId,
        ...(requestId ? { id: requestId } : {}),
      },
    }
    const page = parsePageParams(searchParams)
    const listed = await loadPage(
      page,
      () => prisma.warehouseIssueRelease.count({ where }),
      (skip, take) => prisma.warehouseIssueRelease.findMany({
        where,
        include: {
          request: {
            select: {
              materialType: true,
              unit: true,
              qty: true,
              neededByDate: true,
            },
          },
          releaser: { select: { fullName: true } },
        },
        orderBy: { releasedAt: 'desc' },
        skip,
        take,
      }),
    )
    const rows = listed.rows

    const lotNumbers = [...new Set(rows.map((r) => r.invoiceNumber))]
    const stockMeta =
      lotNumbers.length === 0
        ? []
        : await prisma.stockEntry.findMany({
            where: { factoryId, invoiceNumber: { in: lotNumbers } },
            select: { invoiceNumber: true, supplierName: true },
          })
    const supplierByLot = new Map(stockMeta.map((s) => [s.invoiceNumber, s.supplierName]))

    const receipts =
      lotNumbers.length === 0
        ? []
        : await prisma.procurementReceipt.findMany({
            where: { factoryId, receiptNumber: { in: lotNumbers } },
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
    for (const [lot, rid] of receiptIdByLot) {
      purityByLot.set(lot, purityFromQcLogs(logsByReceipt.get(rid) ?? []))
    }

    return NextResponse.json({
      success: true,
      total: listed.total,
      page: listed.page,
      pageSize: listed.pageSize,
      releases: rows.map((r) => ({
        ...serializeWarehouseIssueRelease(r),
        material_type: r.request.materialType,
        unit: r.request.unit,
        request_qty: Number(r.request.qty),
        needed_by_date: r.request.neededByDate
          ? new Date(r.request.neededByDate).toISOString().slice(0, 10)
          : null,
        supplier_name: supplierByLot.get(r.invoiceNumber) ?? null,
        purity: purityByLot.get(r.invoiceNumber) ?? null,
        released_by_name: r.releaser?.fullName ?? null,
      })),
    })
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

/** Warehouse manager releases stock lots against a plant issue request. */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireProfile(request, ['warehouse_manager'])
    if (auth.error) return auth.error

    const body = await request.json()
    const requestId = String(body.request_id || '')
    const linesRaw = Array.isArray(body.lines) ? (body.lines as ReleaseLine[]) : []

    if (!requestId || linesRaw.length === 0) {
      return NextResponse.json(
        { error: 'request_id and at least one line are required' },
        { status: 400 },
      )
    }

    const lines = linesRaw.map((l) => ({
      invoice_number: String(l.invoice_number || '').trim(),
      qty: Number(l.qty),
    }))

    for (const line of lines) {
      if (!line.invoice_number || !Number.isFinite(line.qty) || line.qty <= 0) {
        return NextResponse.json(
          { error: 'Each line needs invoice_number and qty > 0' },
          { status: 400 },
        )
      }
    }

    const issue = await prisma.warehouseIssueRequest.findUnique({ where: { id: requestId } })
    if (!issue) return NextResponse.json({ error: 'Request not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: issue.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (issue.status !== 'pending' && issue.status !== 'partial') {
      return NextResponse.json(
        { error: `Cannot release against a request that is ${issue.status}` },
        { status: 400 },
      )
    }

    const already = Number(issue.qtyReleased)
    const requested = Number(issue.qty)
    const remainingNeed = requested - already
    if (remainingNeed <= 1e-9) {
      return NextResponse.json({ error: 'Request is already fully released' }, { status: 400 })
    }

    const releaseTotal = lines.reduce((s, l) => s + l.qty, 0)
    if (releaseTotal - remainingNeed > 1e-6) {
      return NextResponse.json(
        {
          error: `Release qty ${releaseTotal} exceeds remaining need ${remainingNeed.toFixed(3)}`,
        },
        { status: 400 },
      )
    }

    const requestKind = parseStockKind(issue.stockKind)
    // Validate lots belong to factory + material and have balance
    for (const line of lines) {
      const stock = await prisma.stockEntry.findUnique({
        where: { invoiceNumber: line.invoice_number },
      })
      if (!stock || stock.factoryId !== issue.factoryId) {
        return NextResponse.json(
          { error: `Invoice ${line.invoice_number} not found in this factory` },
          { status: 400 },
        )
      }
      if (stock.materialType.toLowerCase() !== issue.materialType.toLowerCase()) {
        return NextResponse.json(
          {
            error: `Invoice ${line.invoice_number} is ${stock.materialType}, request is ${issue.materialType}`,
          },
          { status: 400 },
        )
      }
      const requestGrade = parseStockGrade(issue.stockGrade)
      const lotGrade = parseStockGrade(stock.stockGrade)
      if (lotGrade !== requestGrade) {
        return NextResponse.json(
          {
            error: `Invoice ${line.invoice_number} is ${lotGrade} stock; this request needs ${requestGrade} lots`,
          },
          { status: 400 },
        )
      }
      const lotKind = parseStockKind(stock.stockKind)
      if (lotKind !== requestKind) {
        return NextResponse.json(
          {
            error: `Invoice ${line.invoice_number} is ${lotKind} stock; this request needs ${requestKind} lots`,
          },
          { status: 400 },
        )
      }
      if (lotKind === 'fg' || lotKind === 'byproduct') {
        return NextResponse.json(
          { error: 'Finished goods and byproduct cannot be released to plant' },
          { status: 400 },
        )
      }
      const remaining = await getInvoiceRemaining(line.invoice_number)
      if (remaining == null || line.qty > remaining + 1e-9) {
        return NextResponse.json(
          {
            error: `Only ${(remaining ?? 0).toFixed(3)} available on ${line.invoice_number}`,
          },
          { status: 400 },
        )
      }
    }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const result = await prisma.$transaction(async (tx) => {
      const createdReleases = []
      for (const line of lines) {
        const usage = await createUsageFromLot(tx, {
            factoryId: issue.factoryId,
            invoiceNumber: line.invoice_number,
            tonsUsed: line.qty,
            batchNotes: `Warehouse release for issue request ${issue.id.slice(0, 8)}`,
            processId: `WH-ISSUE:${issue.id}`,
            usageDate: today,
            createdBy: auth.profile.id,
            usageReason: 'warehouse_release',
            expectedKind: requestKind,
          }) as { id: string }

        const release = await tx.warehouseIssueRelease.create({
          data: {
            requestId: issue.id,
            invoiceNumber: line.invoice_number,
            qty: line.qty,
            usageEntryId: usage.id,
            releasedBy: auth.profile.id,
          },
        })
        createdReleases.push(release)
      }

      const newReleased = already + releaseTotal
      const status =
        newReleased + 1e-9 >= requested ? 'released' : 'partial'

      const updated = await tx.warehouseIssueRequest.update({
        where: { id: issue.id },
        data: {
          qtyReleased: newReleased,
          status,
          releasedBy: auth.profile.id,
          releasedAt: new Date(),
        },
      })

      return { updated, createdReleases }
    })

    return NextResponse.json({
      success: true,
      request: serializeWarehouseIssueRequest(result.updated),
      releases: result.createdReleases.map(serializeWarehouseIssueRelease),
    })
  } catch (err: unknown) {
    if (err instanceof UsageLotError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
