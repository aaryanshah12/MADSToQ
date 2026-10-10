import { createUsageFromLot, prisma, queryStockBalance, parseStockKind, serializeUsageEntry, UsageLotError } from '@madstoq/database'
import { NextResponse } from 'next/server'

interface UsageItem {
  factory_id: string
  invoice_number: string
  tons_used: number
}

export async function POST(request: Request) {
  try {
    const {
      usages,
      process_id,
      batch_notes,
      shift,
      usage_date,
      batch_month,
      batch_id,
      created_by,
    } = await request.json()

    const normalizedMonth = String(batch_month ?? '').trim()
    const normalizedBatchId = String(batch_id ?? '').trim()

    if (!Array.isArray(usages) || usages.length === 0 || !created_by || !normalizedMonth || !normalizedBatchId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const cleaned: UsageItem[] = usages
      .map((u: any) => ({
        factory_id: String(u.factory_id ?? '').trim(),
        invoice_number: String(u.invoice_number ?? '').trim(),
        tons_used: Number(u.tons_used),
      }))
      .filter(u => u.factory_id && u.invoice_number && !Number.isNaN(u.tons_used))

    if (cleaned.length !== usages.length) {
      return NextResponse.json({ error: 'Each usage needs factory_id, invoice_number, tons_used' }, { status: 400 })
    }

    const invoiceTotals: Record<string, number> = {}
    cleaned.forEach(u => {
      invoiceTotals[u.invoice_number] = (invoiceTotals[u.invoice_number] ?? 0) + Number(u.tons_used)
    })

    const invoiceNumbers = Object.keys(invoiceTotals)
    const balances = await queryStockBalance({ invoiceNumbers })

    if (balances.length !== invoiceNumbers.length) {
      return NextResponse.json({ error: 'One or more invoices not found' }, { status: 404 })
    }

    for (const bal of balances) {
      const totalRequested = invoiceTotals[bal.invoice_number]
      if (Number(totalRequested) > Number(bal.tons_remaining)) {
        return NextResponse.json({
          error: `Invoice ${bal.invoice_number} has only ${Number(bal.tons_remaining).toFixed(3)} KGS available`,
        }, { status: 400 })
      }
      if (parseStockKind(bal.stock_kind) !== 'rm') {
        return NextResponse.json({
          error: `Lot ${bal.invoice_number} is not raw material. Chemist log usage is RM only.`,
        }, { status: 400 })
      }
    }

    const usageDate = new Date(usage_date || new Date().toISOString().split('T')[0])
    const entries = await prisma.$transaction(async (tx) => {
      const created = []
      for (const u of cleaned) {
        created.push(
          await createUsageFromLot(tx, {
            factoryId: u.factory_id,
            invoiceNumber: u.invoice_number,
            tonsUsed: Number(u.tons_used),
            processId: process_id || null,
            batchNotes: batch_notes || null,
            shift: shift || null,
            usageDate,
            batchMonth: normalizedMonth,
            batchId: normalizedBatchId,
            createdBy: created_by,
            usageReason: 'plant_consume',
            expectedKind: 'rm',
          }),
        )
      }
      return created
    })

    return NextResponse.json({
      success: true,
      entries: entries.map((e) => serializeUsageEntry(e as any)),
    })
  } catch (err: any) {
    if (err instanceof UsageLotError) {
      return NextResponse.json({ error: err.message }, { status: err.status })
    }
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
