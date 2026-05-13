import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// POST /api/usage — Create usage entry
export async function POST(request: Request) {
  try {
    const {
      factory_id, invoice_number, tons_used,
      process_id, batch_notes, shift, usage_date, created_by
    } = await request.json()

    if (!factory_id || !invoice_number || !tons_used || !created_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate stock availability
    const { data: balance } = await supabaseAdmin
      .from('stock_balance')
      .select('tons_remaining')
      .eq('invoice_number', invoice_number)
      .single()

    if (!balance) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 })
    }

    if (Number(tons_used) > Number(balance.tons_remaining)) {
      return NextResponse.json({
        error: `Only ${Number(balance.tons_remaining).toFixed(3)}T available. Cannot use ${tons_used}T.`
      }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('usage_entries')
      .insert({
        factory_id,
        invoice_number,
        tons_used:   Number(tons_used),
        process_id:  process_id  || null,
        batch_notes: batch_notes || null,
        shift:       shift       || null,
        usage_date:  usage_date  || new Date().toISOString().split('T')[0],
        created_by,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true, entry: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/usage — Delete usage entry
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry ID required' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('usage_entries')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
