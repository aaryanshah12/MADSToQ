import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

type OutwardInput = {
  id?: string
  factory_id: string
  product_id: string
  product_name?: string
  entry_date?: string
  batch_no: string
  no_of_bags: number
  as_is: number
  purity: number
  created_by: string
}

const round2 = (v: number) => Math.round(v * 100) / 100

const computeReal = (payload: OutwardInput) => {
  const asIs = Number(payload.as_is ?? 0)
  const purity = Number(payload.purity ?? 0)
  return round2((asIs * purity) / 100)
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const factoryIds = searchParams.get('factoryIds')?.split(',').filter(Boolean)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabaseAdmin
    .from('outward_entries')
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
    const payload: OutwardInput = await request.json()
    if (
      !payload.factory_id ||
      !payload.product_id ||
      !payload.batch_no ||
      payload.no_of_bags === undefined ||
      payload.as_is === undefined ||
      payload.purity === undefined ||
      !payload.created_by
    ) {
      return NextResponse.json({ error: 'factory_id, product_id, entry_date, batch_no, no_of_bags, as_is, purity, created_by are required' }, { status: 400 })
    }

    const { data: productRow, error: productErr } = await supabaseAdmin
      .from('factory_inout_products')
      .select('id, factory_id, kind, name, is_active')
      .eq('id', payload.product_id)
      .single()

    if (productErr || !productRow) return NextResponse.json({ error: 'Invalid product' }, { status: 400 })
    if (!productRow.is_active) return NextResponse.json({ error: 'Product is inactive' }, { status: 400 })
    if (productRow.factory_id !== payload.factory_id || productRow.kind !== 'outward') {
      return NextResponse.json({ error: 'Product does not belong to factory/kind' }, { status: 400 })
    }

    const real = computeReal(payload)

    const { data, error } = await supabaseAdmin
      .from('outward_entries')
      .insert({
        factory_id: payload.factory_id,
        product_id: payload.product_id,
        product_name: productRow.name,
        entry_date: payload.entry_date ?? new Date().toISOString().split('T')[0],
        batch_no: String(payload.batch_no).trim(),
        no_of_bags: Number(payload.no_of_bags),
        as_is: Number(payload.as_is),
        purity: Number(payload.purity),
        real,
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
      .from('outward_entries')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

