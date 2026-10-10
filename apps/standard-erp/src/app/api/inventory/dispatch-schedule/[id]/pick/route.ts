import {
  createUsageFromLot,
  getInvoiceRemaining,
  parseStockGrade,
  parseStockKind,
  prisma,
  serializeDispatchSchedule,
  UsageLotError,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'
import { DISPATCH_SCHEDULE_INCLUDE } from '@/lib/dispatch-schedule'
import { finishedGoodsCoaError, issueDispatchLotCoas } from '@/lib/dispatch-coa'

/** Lab allocates FG warehouse lot(s) to a schedule and deducts stock. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, ['lab_incharge', 'owner'])
    if (auth.error) return auth.error

    const { id } = await params
    const body = await request.json()
    const linesRaw = Array.isArray(body.lines) ? body.lines : []
    const lines = linesRaw
      .map((l: { invoice_number?: string; qty?: number }) => ({
        invoiceNumber: String(l.invoice_number || '').trim(),
        qty: Number(l.qty),
      }))
      .filter((l: { invoiceNumber: string; qty: number }) => l.invoiceNumber)

    if (lines.length === 0) {
      return NextResponse.json({ error: 'Select at least one lot' }, { status: 400 })
    }

    const sale = await prisma.dispatchSchedule.findUnique({ where: { id } })
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: sale.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    if (sale.status !== 'instructed') {
      return NextResponse.json(
        { error: `Cannot allocate lots when status is ${sale.status}` },
        { status: 400 },
      )
    }
    if (String(sale.scheduleKind || '') === 'byproduct') {
      return NextResponse.json(
        { error: 'Byproduct schedules do not use lot allocation. Invoice deducts FIFO lots.' },
        { status: 400 },
      )
    }

    const tallyInvoiceNo = String(body.tally_invoice_no || '').trim()
    const drumCount = Number(body.drum_count)
    if (!tallyInvoiceNo) {
      return NextResponse.json({ error: 'Tally invoice number is required' }, { status: 400 })
    }
    if (!Number.isInteger(drumCount) || drumCount < 1) {
      return NextResponse.json(
        { error: 'drum_count must be a whole number of drums' },
        { status: 400 },
      )
    }

    const existingLots = await prisma.dispatchScheduleLot.count({ where: { saleId: id } })
    if (existingLots > 0) {
      return NextResponse.json(
        { error: 'Lots already allocated for this schedule' },
        { status: 400 },
      )
    }

    const totalQty = lines.reduce(
      (s: number, l: { qty: number }) => s + (Number.isFinite(l.qty) ? l.qty : 0),
      0,
    )
    if (!Number.isFinite(totalQty) || totalQty <= 0) {
      return NextResponse.json({ error: 'Quantities must be greater than zero' }, { status: 400 })
    }
    if (Math.abs(totalQty - Number(sale.qty)) > 1e-6) {
      return NextResponse.json(
        {
          error: `Allocated qty (${totalQty}) must equal scheduled qty (${Number(sale.qty)})`,
        },
        { status: 400 },
      )
    }

    const seen = new Set<string>()
    for (const line of lines) {
      if (seen.has(line.invoiceNumber)) {
        return NextResponse.json(
          { error: `Duplicate lot ${line.invoiceNumber}` },
          { status: 400 },
        )
      }
      seen.add(line.invoiceNumber)
      if (!Number.isFinite(line.qty) || line.qty <= 0) {
        return NextResponse.json(
          { error: `Invalid qty for ${line.invoiceNumber}` },
          { status: 400 },
        )
      }

      const stock = await prisma.stockEntry.findUnique({
        where: { invoiceNumber: line.invoiceNumber },
      })
      if (!stock || stock.factoryId !== sale.factoryId) {
        return NextResponse.json(
          { error: `Warehouse lot ${line.invoiceNumber} not found` },
          { status: 404 },
        )
      }
      const kind = parseStockKind(stock.stockKind)
      if (kind !== 'fg') {
        return NextResponse.json(
          {
            error:
              kind === 'sfg'
                ? 'Semi-finished goods cannot be allocated to sales.'
                : `Lot ${line.invoiceNumber} is not finished goods.`,
          },
          { status: 400 },
        )
      }

      const grade = parseStockGrade(stock.stockGrade)
      if (sale.isDiscounted && grade !== 'rejected') {
        return NextResponse.json(
          { error: 'Discounted schedules require rejected FG lots' },
          { status: 400 },
        )
      }
      if (!sale.isDiscounted && grade === 'rejected') {
        return NextResponse.json(
          { error: 'Rejected FG requires a discounted schedule' },
          { status: 400 },
        )
      }

      const mat = stock.materialType.toLowerCase()
      const name = sale.productName.toLowerCase()
      const code = sale.productCode.toLowerCase()
      if (mat !== name && mat !== code) {
        return NextResponse.json(
          {
            error: `Lot ${line.invoiceNumber} (${stock.materialType}) does not match ${sale.productName}`,
          },
          { status: 400 },
        )
      }

      const remaining = await getInvoiceRemaining(line.invoiceNumber)
      if (remaining == null || line.qty > remaining + 1e-9) {
        return NextResponse.json(
          {
            error: `Only ${(remaining ?? 0).toFixed(3)} remaining on ${line.invoiceNumber}`,
          },
          { status: 400 },
        )
      }

      const coaError = await finishedGoodsCoaError(sale.factoryId, line.invoiceNumber)
      if (coaError) {
        return NextResponse.json({ error: coaError }, { status: 400 })
      }
    }

    const now = new Date()
    await prisma.$transaction(
      async (tx) => {
        const lotIds: string[] = []
        for (const line of lines) {
          const usage = await createUsageFromLot(tx, {
              factoryId: sale.factoryId,
              invoiceNumber: line.invoiceNumber,
              tonsUsed: line.qty,
              processId: `DISPATCH:${sale.saleNo}`,
              batchNotes: sale.isDiscounted
                ? 'Discounted rejected dispatch allocation'
                : 'Dispatch schedule allocation',
              usageDate: now,
              createdBy: auth.profile.id,
              usageReason: 'fg_dispatch',
              expectedKind: 'fg',
            }) as { id: string }
          const lot = await tx.dispatchScheduleLot.create({
            data: {
              saleId: sale.id,
              invoiceNumber: line.invoiceNumber,
              qty: line.qty,
              usageEntryId: usage.id,
            },
          })
          lotIds.push(lot.id)
        }
        const coaNo = await issueDispatchLotCoas(tx, {
          factoryId: sale.factoryId,
          saleId: sale.id,
          lotIds,
          issuedBy: auth.profile.id,
          now,
        })
        await tx.dispatchSchedule.update({
          where: { id: sale.id },
          data: {
            tallyInvoiceNo,
            drumCount,
            status: 'coa_issued',
            pickedBy: auth.profile.id,
            pickedAt: now,
            coaNo,
            coaIssuedAt: now,
            coaIssuedBy: auth.profile.id,
          },
        })
      },
      { timeout: 20000, maxWait: 10000 },
    )

    const saleOut = await prisma.dispatchSchedule.findUnique({
      where: { id: sale.id },
      include: DISPATCH_SCHEDULE_INCLUDE,
    })

    return NextResponse.json({
      success: true,
      generated_coa: true,
      sale: serializeDispatchSchedule(saleOut!),
    })
  } catch (err: unknown) {
    if (err instanceof UsageLotError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
