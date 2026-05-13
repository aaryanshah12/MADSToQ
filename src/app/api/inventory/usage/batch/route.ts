import { supabaseAdmin } from '@/lib/supabaseAdmin'
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

    // Aggregate usage per invoice to validate balances
    const invoiceTotals: Record<string, number> = {}
    cleaned.forEach(u => {
      invoiceTotals[u.invoice_number] = (invoiceTotals[u.invoice_number] ?? 0) + Number(u.tons_used)
    })

    const invoiceNumbers = Object.keys(invoiceTotals)
    const { data: balances, error: balError } = await supabaseAdmin
      .from('stock_balance')
      .select('invoice_number, tons_remaining')
      .in('invoice_number', invoiceNumbers)

    if (balError) return NextResponse.json({ error: balError.message }, { status: 400 })
    if (!balances || balances.length !== invoiceNumbers.length) {
      return NextResponse.json({ error: 'One or more invoices not found' }, { status: 404 })
    }

    for (const bal of balances) {
      const totalRequested = invoiceTotals[bal.invoice_number]
      if (Number(totalRequested) > Number(bal.tons_remaining)) {
        return NextResponse.json({
          error: `Invoice ${bal.invoice_number} has only ${Number(bal.tons_remaining).toFixed(3)} KGS available`,
        }, { status: 400 })
      }
    }

    const rows = cleaned.map(u => ({
      factory_id: u.factory_id,
      invoice_number: u.invoice_number,
      tons_used: Number(u.tons_used),
      process_id:  process_id  || null,
      batch_notes: batch_notes || null,
      shift:       shift       || null,
      usage_date:  usage_date  || new Date().toISOString().split('T')[0],
      batch_month: normalizedMonth,
      batch_id:    normalizedBatchId,
      created_by,
    }))

    const { data, error } = await supabaseAdmin
      .from('usage_entries')
      .insert(rows)
      .select()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true, entries: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
