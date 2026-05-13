import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'

type SalesEntryInput = {
  id?: string
  fiscal_year: string
  month: number
  factory_id: string
  turnover?: number | null
  pntosa?: number | null
  hydrazone?: number | null
  notes?: string | null
  lines?: Array<{
    product_name: string
    price_rupees?: number | null
    quantity_kg?: number | null
  }>
  created_by: string
}

const toNumOrNull = (v: any) => {
  if (v === '' || v === undefined || v === null) return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

const normalizeProductKey = (name: string) => {
  const n = String(name ?? '').trim().toLowerCase()
  if (n === 'pnt') return 'pntosa'
  if (n === 'pntosa') return 'pntosa'
  if (n === '4sh') return 'hydrazone'
  if (n === 'hydrazone') return 'hydrazone'
  if (n === 'turnover') return 'turnover'
  return n
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const fiscalYear = searchParams.get('fiscal_year')
  const factoryId  = searchParams.get('factory_id')
  const month      = searchParams.get('month')

  if (!fiscalYear) return NextResponse.json({ error: 'fiscal_year is required' }, { status: 400 })
  if (!factoryId)  return NextResponse.json({ error: 'factory_id is required' },  { status: 400 })

  let query = supabaseAdmin
    .from('sales_entries')
    .select('*, sales_entry_lines(*)')
    .eq('fiscal_year', fiscalYear)
    .eq('factory_id', factoryId)
    .order('month', { ascending: true })

  if (month) query = query.eq('month', Number(month))

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ entries: data ?? [] })
}

export async function POST(request: Request) {
  try {
    const payload: SalesEntryInput = await request.json()
    if (!payload.fiscal_year || !payload.month || !payload.created_by || !payload.factory_id) {
      return NextResponse.json({ error: 'fiscal_year, month, factory_id, created_by are required' }, { status: 400 })
    }

    const lines = (payload.lines ?? [])
      .map(l => ({
        product_name: String(l.product_name ?? '').trim(),
        price_rupees: toNumOrNull(l.price_rupees),
        quantity_kg: toNumOrNull(l.quantity_kg),
      }))
      .filter(l => l.product_name.length > 0)

    const byKey = (key: string) => lines.find(l => normalizeProductKey(l.product_name) === normalizeProductKey(key))
    const turnoverLine = byKey('turnover')
    const pntosaLine = byKey('pntosa')
    const hydrazoneLine = byKey('hydrazone')

    // Upsert by FY+month+factory (enforced by unique index)
    const { data, error } = await supabaseAdmin
      .from('sales_entries')
      .upsert({
        fiscal_year: String(payload.fiscal_year).trim(),
        month: Number(payload.month),
        factory_id: payload.factory_id,
        turnover: toNumOrNull(payload.turnover) ?? (turnoverLine?.price_rupees ?? null),
        pntosa: toNumOrNull(payload.pntosa) ?? (pntosaLine?.price_rupees ?? null),
        hydrazone: toNumOrNull(payload.hydrazone) ?? (hydrazoneLine?.price_rupees ?? null),
        notes: payload.notes ?? null,
        created_by: payload.created_by,
      }, { onConflict: 'fiscal_year,month,factory_id' })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    const entryId = data?.id
    if (entryId) {
      const { error: delErr } = await supabaseAdmin
        .from('sales_entry_lines')
        .delete()
        .eq('sales_entry_id', entryId)
      if (delErr) return NextResponse.json({ error: delErr.message }, { status: 400 })

      if (lines.length > 0) {
        const { error: insErr } = await supabaseAdmin
          .from('sales_entry_lines')
          .insert(lines.map(l => ({ ...l, sales_entry_id: entryId })))
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
      }
    }

    const { data: fresh, error: freshErr } = await supabaseAdmin
      .from('sales_entries')
      .select('*, sales_entry_lines(*)')
      .eq('id', data.id)
      .single()
    if (freshErr) return NextResponse.json({ error: freshErr.message }, { status: 400 })

    return NextResponse.json({ success: true, entry: fresh })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const payload: SalesEntryInput = await request.json()
    if (!payload.id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('sales_entries')
      .update({
        fiscal_year: payload.fiscal_year ? String(payload.fiscal_year).trim() : undefined,
        month: payload.month ? Number(payload.month) : undefined,
        turnover: payload.turnover === undefined ? undefined : toNumOrNull(payload.turnover),
        pntosa: payload.pntosa === undefined ? undefined : toNumOrNull(payload.pntosa),
        hydrazone: payload.hydrazone === undefined ? undefined : toNumOrNull(payload.hydrazone),
        notes: payload.notes === undefined ? undefined : (payload.notes ?? null),
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
      .from('sales_entries')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

