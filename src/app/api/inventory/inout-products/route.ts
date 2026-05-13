import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

type Kind = 'inward' | 'outward'

async function getUserId(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const bearer = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null

  if (!bearer) return null
  const { data, error } = await supabaseAdmin.auth.getUser(bearer)
  if (error || !data?.user) return null
  return data.user.id
}

async function allowedFactoryIdsFor(userId: string) {
  const { data } = await supabaseAdmin
    .from('profile_factories')
    .select('factory_id')
    .eq('profile_id', userId)
  return (data ?? []).map((r: any) => r.factory_id).filter(Boolean)
}

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { searchParams } = new URL(request.url)
    const kind = (searchParams.get('kind') ?? '') as Kind
    const factoryId = searchParams.get('factory_id')
    const includeInactive = searchParams.get('include_inactive') === 'true'

    if (kind !== 'inward' && kind !== 'outward') {
      return NextResponse.json({ error: 'kind must be inward|outward' }, { status: 400 })
    }

    const allowed = await allowedFactoryIdsFor(userId)
    if (allowed.length === 0) return NextResponse.json({ products: [] })

    let query = supabaseAdmin
      .from('factory_inout_products')
      .select('*')
      .eq('kind', kind)
      .order('name', { ascending: true })

    if (!includeInactive) query = query.eq('is_active', true)

    if (factoryId) {
      if (!allowed.includes(factoryId)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      query = query.eq('factory_id', factoryId)
    } else {
      query = query.in('factory_id', allowed)
    }

    const { data, error } = await query
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ products: data ?? [] })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabaseAdmin.from('profiles').select('id, role').eq('id', userId).single()
    if (!profile || profile.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { factory_id, kind, name } = await request.json()
    if (!factory_id || !kind || !name) {
      return NextResponse.json({ error: 'factory_id, kind, name are required' }, { status: 400 })
    }
    if (kind !== 'inward' && kind !== 'outward') {
      return NextResponse.json({ error: 'kind must be inward|outward' }, { status: 400 })
    }

    const allowed = await allowedFactoryIdsFor(userId)
    if (!allowed.includes(factory_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { data, error } = await supabaseAdmin
      .from('factory_inout_products')
      .insert({
        factory_id,
        kind,
        name: String(name).trim(),
        is_active: true,
        created_by: userId,
      })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true, product: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const userId = await getUserId(request)
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: profile } = await supabaseAdmin.from('profiles').select('id, role').eq('id', userId).single()
    if (!profile || profile.role !== 'owner') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { id, is_active, name } = await request.json()
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 })

    const updates: any = {}
    if (is_active !== undefined) updates.is_active = Boolean(is_active)
    if (name !== undefined) updates.name = String(name).trim()

    const { data: existing, error: existingErr } = await supabaseAdmin
      .from('factory_inout_products')
      .select('id, factory_id')
      .eq('id', id)
      .single()

    if (existingErr || !existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const allowed = await allowedFactoryIdsFor(userId)
    if (!allowed.includes(existing.factory_id)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error } = await supabaseAdmin.from('factory_inout_products').update(updates).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

