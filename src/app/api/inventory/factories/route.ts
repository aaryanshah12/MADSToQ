import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// GET /api/factories — Only return factories the signed-in owner can access
export async function GET(request: NextRequest) {
  try {
    // Bearer token (required)
    const authHeader = request.headers.get('authorization')
    const bearer = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null

    if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data, error } = await supabaseAdmin.auth.getUser(bearer)
    if (error || !data?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = data.user.id

    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, role')
      .eq('id', userId)
      .single()

    if (!ownerProfile || ownerProfile.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { data: ownerFactories } = await supabaseAdmin
      .from('profile_factories')
      .select('factory_id')
      .eq('profile_id', userId)

    const allowedFactoryIds = (ownerFactories ?? []).map((r: any) => r.factory_id).filter(Boolean)

    if (allowedFactoryIds.length === 0) {
      return NextResponse.json({ factories: [], profiles: [], factoryUsersMap: {}, assignedFactories: [] })
    }

    const [{ data: factories, error: factoriesError }, { data: pfRows }] = await Promise.all([
      supabaseAdmin.from('factories').select('*').in('id', allowedFactoryIds).order('created_at', { ascending: true }),
      supabaseAdmin.from('profile_factories').select('profile_id, factory_id').in('factory_id', allowedFactoryIds),
    ])

    if (factoriesError) return NextResponse.json({ error: factoriesError.message }, { status: 400 })

    // Build map: factory_id -> [profile_id, ...]
    const factoryUsersMap: Record<string, string[]> = {}
    ;(pfRows ?? []).forEach((r: any) => {
      if (!factoryUsersMap[r.factory_id]) factoryUsersMap[r.factory_id] = []
      factoryUsersMap[r.factory_id].push(r.profile_id)
    })

    const profileIds = Array.from(new Set((pfRows ?? []).map((r: any) => r.profile_id)))

    const { data: profiles } = profileIds.length > 0
      ? await supabaseAdmin.from('profiles').select('id, full_name, role, is_active').in('id', profileIds).order('full_name')
      : { data: [] }

    return NextResponse.json({
      factories: factories ?? [],
      profiles: profiles ?? [],
      factoryUsersMap,
      assignedFactories: allowedFactoryIds
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}


// POST /api/factories — Create new factory and auto-assign to creating owner
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const bearer = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null
    if (!bearer) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: authData, error: authError } = await supabaseAdmin.auth.getUser(bearer)
    if (authError || !authData?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const userId = authData.user.id

    const { data: ownerProfile } = await supabaseAdmin
      .from('profiles').select('id, role').eq('id', userId).single()
    if (!ownerProfile || ownerProfile.role !== 'owner') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { name, location, materials } = await request.json()
    if (!name) return NextResponse.json({ error: 'Factory name is required' }, { status: 400 })

    const { data, error } = await supabaseAdmin
      .from('factories')
      .insert({ name, location: location || null, materials: materials ?? null })
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Auto-assign the creating owner to this factory
    await supabaseAdmin.from('profile_factories').insert({ profile_id: userId, factory_id: data.id })

    return NextResponse.json({ success: true, factory: data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/factories — Update factory
export async function PATCH(request: Request) {
  try {
    const { id, name, location, is_active, materials } = await request.json()

    if (!id) return NextResponse.json({ error: 'Factory ID required' }, { status: 400 })

    const updates: any = {}
    if (name      !== undefined) updates.name      = name
    if (location  !== undefined) updates.location  = location || null
    if (is_active !== undefined) updates.is_active = is_active
    if (materials !== undefined) updates.materials = materials ?? null

    const { error } = await supabaseAdmin
      .from('factories')
      .update(updates)
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/factories — Delete factory
export async function DELETE(request: Request) {
  try {
    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'Factory ID required' }, { status: 400 })

    const { error } = await supabaseAdmin
      .from('factories')
      .delete()
      .eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
