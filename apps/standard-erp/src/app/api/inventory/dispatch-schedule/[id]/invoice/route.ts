import {
  createUsageFromLot,
  prisma,
  serializeDispatchSchedule,
  UsageLotError,
} from '@madstoq/database'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { requireProfile } from '@/lib/qc-api-helpers'
import { DISPATCH_SCHEDULE_INCLUDE } from '@/lib/dispatch-schedule'
import { fifoByproductLines, parseScheduleKind } from '@/lib/byproduct-dispatch'
import { finishedGoodsCoaError, issueDispatchLotCoas } from '@/lib/dispatch-coa'

/** Accountant records vehicle, and can correct the Tally invoice and drums. COA numbers are issued here only if the lab did not already generate them. */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await requireProfile(request, ['accountant', 'owner'])
    if (auth.error) return auth.error

    const { id } = await params
    const body = await request.json()
    const tallyInvoiceNo = String(body.tally_invoice_no || '').trim()
    const vehicleNo = String(body.vehicle_no || '').trim()
    const drumCount = Number(body.drum_count)

    if (!tallyInvoiceNo || !vehicleNo) {
      return NextResponse.json(
        { error: 'tally_invoice_no and vehicle_no are required' },
        { status: 400 },
      )
    }
    if (!Number.isInteger(drumCount) || drumCount < 1) {
      return NextResponse.json(
        { error: 'drum_count must be a whole number of drums' },
        { status: 400 },
      )
    }

    const sale = await prisma.dispatchSchedule.findUnique({
      where: { id },
      include: { lots: true },
    })
    if (!sale) return NextResponse.json({ error: 'Sale not found' }, { status: 404 })

    const link = await prisma.profileFactory.findFirst({
      where: { profileId: auth.profile.id, factoryId: sale.factoryId },
    })
    if (!link) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const kind = parseScheduleKind(sale.scheduleKind)

    if (kind === 'byproduct') {
      if (sale.status !== 'instructed') {
        return NextResponse.json(
          { error: `Cannot invoice byproduct when status is ${sale.status}` },
          { status: 400 },
        )
      }
      if (sale.lots.length > 0) {
        return NextResponse.json(
          { error: 'Byproduct lots already recorded for this schedule' },
          { status: 400 },
        )
      }

      const fifo = await fifoByproductLines({
        factoryId: sale.factoryId,
        materialName: sale.productName,
        qty: Number(sale.qty),
      })
      if ('error' in fifo) {
        return NextResponse.json({ error: fifo.error }, { status: 400 })
      }

      const updated = await prisma.$transaction(
        async (tx) => {
          for (const line of fifo.lines) {
            const usage = await createUsageFromLot(tx, {
                factoryId: sale.factoryId,
                invoiceNumber: line.invoiceNumber,
                tonsUsed: line.qty,
                processId: `DISPATCH:${sale.saleNo}`,
                batchNotes: 'Byproduct dispatch invoice',
                usageDate: new Date(),
                createdBy: auth.profile.id,
                usageReason: 'byproduct_dispatch',
                expectedKind: 'byproduct',
              }) as { id: string }
            await tx.dispatchScheduleLot.create({
              data: {
                saleId: sale.id,
                invoiceNumber: line.invoiceNumber,
                qty: line.qty,
                usageEntryId: usage.id,
              },
            })
          }
          return tx.dispatchSchedule.update({
            where: { id },
            data: {
              tallyInvoiceNo,
              vehicleNo,
              drumCount,
              status: 'invoiced',
              invoicedBy: auth.profile.id,
              invoicedAt: new Date(),
            },
            include: DISPATCH_SCHEDULE_INCLUDE,
          })
        },
        { timeout: 20000, maxWait: 10000 },
      )

      return NextResponse.json({
        success: true,
        sale: serializeDispatchSchedule(updated),
      })
    }

    if (sale.status !== 'allocated' && sale.status !== 'coa_issued') {
      return NextResponse.json(
        { error: 'Invoice is recorded after lots are allocated. The COA is generated with the invoice.' },
        { status: 400 },
      )
    }

    if (sale.lots.length === 0) {
      return NextResponse.json(
        { error: 'Allocate at least one lot before invoicing' },
        { status: 400 },
      )
    }

    const missingCoa = sale.lots.filter((lot) => !lot.coaNo)
    for (const lot of missingCoa) {
      const coaError = await finishedGoodsCoaError(sale.factoryId, lot.invoiceNumber)
      if (coaError) {
        return NextResponse.json({ error: coaError }, { status: 400 })
      }
    }

    const now = new Date()
    const updated = await prisma.$transaction(
      async (tx) => {
        const coaNo =
          missingCoa.length > 0
            ? await issueDispatchLotCoas(tx, {
                factoryId: sale.factoryId,
                saleId: sale.id,
                lotIds: missingCoa.map((lot) => lot.id),
                issuedBy: auth.profile.id,
                now,
              })
            : null
        return tx.dispatchSchedule.update({
          where: { id },
          data: {
            tallyInvoiceNo,
            vehicleNo,
            drumCount,
            status: 'invoiced',
            invoicedBy: auth.profile.id,
            invoicedAt: now,
            ...(missingCoa.length > 0
              ? {
                  coaNo,
                  coaIssuedAt: now,
                  coaIssuedBy: auth.profile.id,
                }
              : {}),
          },
          include: DISPATCH_SCHEDULE_INCLUDE,
        })
      },
      { timeout: 20000, maxWait: 10000 },
    )

    return NextResponse.json({
      success: true,
      generated_coa: missingCoa.length > 0,
      sale: serializeDispatchSchedule(updated),
    })
  } catch (err: unknown) {
    if (err instanceof UsageLotError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
