import { supabaseAdmin } from '@/lib/supabaseAdmin'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

async function requireOwnerAccess(request: NextRequest) {
  // Bearer token required (sent by our client helpers)
  const authHeader = request.headers.get('authorization')
  const bearer = authHeader?.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null

  if (!bearer) return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data, error } = await supabaseAdmin.auth.getUser(bearer)
  if (error || !data?.user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const userId = data.user.id

  const { data: ownerProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', userId)
    .single()

  if (!ownerProfile || ownerProfile.role !== 'owner') {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const { data: ownerFactories } = await supabaseAdmin
    .from('profile_factories')
    .select('factory_id')
    .eq('profile_id', userId)

  const allowedFactoryIds = (ownerFactories ?? [])
    .map((r: any) => r.factory_id)
    .filter(Boolean)

  return { userId, allowedFactoryIds }
}

// GET /api/users — Only return users tied to factories the signed-in owner can access
export async function GET(request: NextRequest) {
  try {
    const access = await requireOwnerAccess(request)
    if (access.response) return access.response
    const { allowedFactoryIds } = access

    if (allowedFactoryIds.length === 0) {
      return NextResponse.json({ users: [], factories: [], pfMap: {}, assignedFactories: [] })
    }

    // Fetch profile-factory links limited to owner’s factories
    const { data: pfRows } = await supabaseAdmin
      .from('profile_factories')
      .select('profile_id, factory_id')
      .in('factory_id', allowedFactoryIds)

    const profileIds = Array.from(new Set((pfRows ?? []).map((r: any) => r.profile_id)))

    if (profileIds.length === 0) {
      return NextResponse.json({ users: [], factories: [], pfMap: {}, assignedFactories: allowedFactoryIds })
    }

    const [{ data: users, error: usersError }, { data: factories }] = await Promise.all([
      supabaseAdmin.from('profiles').select('*').in('id', profileIds).order('role').order('full_name'),
      supabaseAdmin.from('factories').select('*').in('id', allowedFactoryIds).eq('is_active', true).order('name'),
    ])

    if (usersError) return NextResponse.json({ error: usersError.message }, { status: 400 })

    const pfMap: Record<string, string[]> = {}
    ;(pfRows ?? []).forEach((r: any) => {
      if (!pfMap[r.profile_id]) pfMap[r.profile_id] = []
      pfMap[r.profile_id].push(r.factory_id)
    })

    return NextResponse.json({
      users: users ?? [],
      factories: factories ?? [],
      pfMap,
      assignedFactories: allowedFactoryIds,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}


// POST /api/users — Create new user
export async function POST(request: NextRequest) {
  try {
    const access = await requireOwnerAccess(request)
    if (access.response) return access.response
    const { allowedFactoryIds } = access

    if (allowedFactoryIds.length === 0) {
      return NextResponse.json({ error: 'No factory access configured for this owner' }, { status: 403 })
    }

    const { email, password, full_name, role, phone, factory_ids } = await request.json()

    if (!email || !password || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({
        error: 'SUPABASE_SERVICE_ROLE_KEY missing from .env.local — add it and restart the server'
      }, { status: 500 })
    }

    // Create auth user
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, role }
    })

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    // Upsert profile — works whether trigger fired or not
    await supabaseAdmin.from('profiles').upsert({
      id:        data.user.id,
      full_name,
      email,
      role,
      phone:     phone || null,
      is_active: true,
    }, { onConflict: 'id' })

    // Assign factories if provided
    if (Array.isArray(factory_ids) && factory_ids.length > 0) {
      const safeIds = factory_ids.filter((id: string) => allowedFactoryIds.includes(id))
      if (safeIds.length === 0) {
        return NextResponse.json({ error: 'You can only assign factories you own' }, { status: 403 })
      }
      const rows = safeIds.map((factory_id: string) => ({
        profile_id: data.user.id,
        factory_id,
      }))
      await supabaseAdmin.from('profile_factories').insert(rows)
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// PATCH /api/users — Update user profile + factory assignments
export async function PATCH(request: NextRequest) {
  try {
    const access = await requireOwnerAccess(request)
    if (access.response) return access.response
    const { allowedFactoryIds } = access

    if (allowedFactoryIds.length === 0) {
      return NextResponse.json({ error: 'No factory access configured for this owner' }, { status: 403 })
    }

    const { id, full_name, phone, role, is_active, factory_ids } = await request.json()
    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

    // Update profile fields
    const updates: any = {}
    if (full_name  !== undefined) updates.full_name  = full_name
    if (phone      !== undefined) updates.phone      = phone
    if (role       !== undefined) updates.role       = role
    if (is_active  !== undefined) updates.is_active  = is_active

    if (Object.keys(updates).length > 0) {
      const { error } = await supabaseAdmin.from('profiles').update(updates).eq('id', id)
      if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Replace factory assignments if factory_ids is provided
    if (Array.isArray(factory_ids)) {
      const safeIds = factory_ids.filter((fid: string) => allowedFactoryIds.includes(fid))

      // Only touch factory links the owner actually controls
      if (allowedFactoryIds.length > 0) {
        await supabaseAdmin
          .from('profile_factories')
          .delete()
          .eq('profile_id', id)
          .in('factory_id', allowedFactoryIds)
      }

      if (safeIds.length > 0) {
        const rows = safeIds.map((factory_id: string) => ({ profile_id: id, factory_id }))
        await supabaseAdmin.from('profile_factories').insert(rows)
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

// DELETE /api/users
export async function DELETE(request: NextRequest) {
  try {
    const access = await requireOwnerAccess(request)
    if (access.response) return access.response
    const { allowedFactoryIds } = access

    if (allowedFactoryIds.length === 0) {
      return NextResponse.json({ error: 'No factory access configured for this owner' }, { status: 403 })
    }

    const { id } = await request.json()
    if (!id) return NextResponse.json({ error: 'User ID required' }, { status: 400 })

    const { data: targetFactories } = await supabaseAdmin
      .from('profile_factories')
      .select('factory_id')
      .eq('profile_id', id)

    const hasAccess = (targetFactories ?? []).some((r: any) => allowedFactoryIds.includes(r.factory_id))
    if (!hasAccess) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })

    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
