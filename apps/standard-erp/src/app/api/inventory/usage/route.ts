import { createUsageFromLot, getInvoiceRemaining, prisma, parseStockKind, serializeUsageEntry, UsageLotError } from '@madstoq/database'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const {
      factory_id, invoice_number, tons_used,
      process_id, batch_notes, shift, usage_date, created_by
    } = await request.json()

    if (!factory_id || !invoice_number || !tons_used || !created_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const stock = await prisma.stockEntry.findUnique({
      where: { invoiceNumber: invoice_number },
    })
    if (!stock) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }
    const kind = parseStockKind(stock.stockKind)
    if (kind !== 'rm') {
      return NextResponse.json(
        { error: 'Chemist log usage is for raw material lots only. Use production or dispatch for SFG, FG, and byproduct.' },
        { status: 400 },
      )
    }

    const remaining = await getInvoiceRemaining(invoice_number)
    if (remaining == null) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (Number(tons_used) > remaining) {
      return NextResponse.json({
        error: `Only ${remaining.toFixed(3)}T available. Cannot use ${tons_used}T.`
      }, { status: 400 })
    }

    const entry = await createUsageFromLot(prisma, {
      factoryId: factory_id,
      invoiceNumber: invoice_number,
      tonsUsed: Number(tons_used),
      processId: process_id || null,
      batchNotes: batch_notes || null,
      shift: shift || null,
      usageDate: new Date(usage_date || new Date().toISOString().split('T')[0]),
      createdBy: created_by,
      usageReason: 'plant_consume',
      expectedKind: 'rm',
    })

    return NextResponse.json({ success: true, entry: serializeUsageEntry(entry as any) })
  } catch (err: any) {
    if (err instanceof UsageLotError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry ID required' }, { status: 400 })

    await prisma.usageEntry.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
