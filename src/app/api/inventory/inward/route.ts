import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

type InwardInput = {
  id?: string
  factory_id: string
  product_id: string
  product_name?: string
  entry_date?: string
  tons: number
  created_by: string
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const factoryIds = searchParams.get('factoryIds')?.split(',').filter(Boolean)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabaseAdmin
    .from('inward_entries')
    .select('*')
    .order('entry_date', { ascending: false })
    .order('updated_at', { ascending: false })

  if (factoryIds && factoryIds.length > 0) query = query.in('factory_id', factoryIds)
  if (from) query = query.gte('entry_date', from)
  if (to) query = query.lte('entry_date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(request: Request) {
  try {
    const payload: InwardInput = await request.json()
    if (!payload.factory_id || !payload.product_id || payload.tons === undefined || !payload.created_by) {
      return NextResponse.json({ error: 'factory_id, product_id, tons, created_by are required' }, { status: 400 })
    }

    const { data: productRow, error: productErr } = await supabaseAdmin
      .from('factory_inout_products')
      .select('id, factory_id, kind, name, is_active')
      .eq('id', payload.product_id)
      .single()

    if (productErr || !productRow) return NextResponse.json({ error: 'Invalid product' }, { status: 400 })
    if (!productRow.is_active) return NextResponse.json({ error: 'Product is inactive' }, { status: 400 })
    if (productRow.factory_id !== payload.factory_id || productRow.kind !== 'inward') {
      return NextResponse.json({ error: 'Product does not belong to factory/kind' }, { status: 400 })
    }

    const { data, error } = await supabaseAdmin
      .from('inward_entries')
      .insert({
        factory_id: payload.factory_id,
        product_id: payload.product_id,
        product_name: productRow.name,
        entry_date: payload.entry_date ?? new Date().toISOString().split('T')[0],
        tons: Number(payload.tons),
        created_by: payload.created_by,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, entry: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('inward_entries')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

