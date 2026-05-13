import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

type EntryInput = {
  id?: string
  factory_id: string
  batch_id: string
  month: number
  fiscal_year: string
  oleum_23?: number
  as_is_kg?: number
  purity_nv?: number
  free_acidity?: number
  used_pnt?: number
  created_by: string
}

const round2 = (v: number) => Math.round(v * 100) / 100

const compute = (payload: EntryInput) => {
  const asIs = Number(payload.as_is_kg ?? 0)
  const purity = Number(payload.purity_nv ?? 0)
  const usedPnt = Number(payload.used_pnt ?? 5000)
  const actualReal = round2((asIs * purity) / 100)
  const yieldPct = round2(usedPnt > 0 ? actualReal / usedPnt : 0)
  return { actualReal, yieldPct, usedPnt }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fiscalYear = searchParams.get('fiscal_year')
  const month = searchParams.get('month')
  const factoryIds = searchParams.get('factoryIds')?.split(',').filter(Boolean)

  if (!fiscalYear || !month) {
    return NextResponse.json({ error: 'fiscal_year and month are required' }, { status: 400 })
  }

  let query = supabaseAdmin
    .from('monthly_material_entries')
    .select('*')
    .eq('fiscal_year', fiscalYear)
    .eq('month', Number(month))
    .order('updated_at', { ascending: false })

  if (factoryIds && factoryIds.length > 0) {
    query = query.in('factory_id', factoryIds)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(request: Request) {
  try {
    const payload: EntryInput = await request.json()
    if (!payload.factory_id || !payload.batch_id || !payload.month || !payload.fiscal_year || !payload.created_by) {
      return NextResponse.json({ error: 'factory_id, batch_id, month, fiscal_year, created_by are required' }, { status: 400 })
    }
    const { actualReal, yieldPct, usedPnt } = compute(payload)

    const { data, error } = await supabaseAdmin
      .from('monthly_material_entries')
      .insert({
        factory_id: payload.factory_id,
        batch_id: String(payload.batch_id).trim(),
        month: Number(payload.month),
        fiscal_year: String(payload.fiscal_year).trim(),
        oleum_23: payload.oleum_23 ?? null,
        as_is_kg: payload.as_is_kg ?? null,
        purity_nv: payload.purity_nv ?? null,
        free_acidity: payload.free_acidity ?? null,
        actual_real_kg: actualReal,
        used_pnt: usedPnt,
        yield_pct: yieldPct,
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

export async function PATCH(request: Request) {
  try {
    const payload: EntryInput = await request.json()
    if (!payload.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })
    const { actualReal, yieldPct, usedPnt } = compute(payload)

    const { error } = await supabaseAdmin
      .from('monthly_material_entries')
      .update({
        factory_id: payload.factory_id,
        batch_id: payload.batch_id,
        month: payload.month,
        fiscal_year: payload.fiscal_year,
        oleum_23: payload.oleum_23 ?? null,
        as_is_kg: payload.as_is_kg ?? null,
        purity_nv: payload.purity_nv ?? null,
        free_acidity: payload.free_acidity ?? null,
        actual_real_kg: actualReal,
        used_pnt: usedPnt,
        yield_pct: yieldPct,
      })
      .eq('id', payload.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('monthly_material_entries')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
