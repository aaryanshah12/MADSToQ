import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

// POST /api/stock — Create stock entry
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      factory_id, invoice_number, supplier_name, material_type,
      tons_loaded, rate_per_ton, vehicle_number, driver_name,
      entry_date, notes, created_by
    } = body

    if (!factory_id || !invoice_number || !supplier_name || !material_type || !tons_loaded || !rate_per_ton || !created_by) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('stock_entries')
      .insert({
        factory_id,
        invoice_number,
        supplier_name,
        material_type,
        tons_loaded:    Number(tons_loaded),
        rate_per_ton:   Number(rate_per_ton),
        vehicle_number: vehicle_number  || null,
        driver_name:    driver_name     || null,
        entry_date:     entry_date      || new Date().toISOString().split('T')[0],
        notes:          notes           || null,
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

// PATCH /api/stock — Update stock entry
export async function PATCH(request: Request) {
  try {
    const { id, ...updates } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry ID required' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('stock_entries')
      .update(updates)
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/stock — Delete stock entry
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Entry ID required' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('stock_entries')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
