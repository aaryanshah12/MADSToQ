import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabase-admin'
import { getBearerToken, requireAuthenticatedUser } from './api-auth'

const OWNER_CACHE_TTL_MS = 60_000
const ownerCache = new Map<string, { allowedFactoryIds: string[]; expiresAt: number }>()

export async function requireOwnerAccess(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('error' in auth && auth.error) return { response: auth.error }

  const { user } = auth
  const cached = ownerCache.get(user.id)
  if (cached && Date.now() < cached.expiresAt) {
    return { userId: user.id, allowedFactoryIds: cached.allowedFactoryIds }
  }

  const { data: ownerProfile } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  if (!ownerProfile || ownerProfile.role !== 'owner') {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  const { data: ownerFactories } = await supabaseAdmin
    .from('profile_factories')
    .select('factory_id')
    .eq('profile_id', user.id)

  const allowedFactoryIds = (ownerFactories ?? [])
    .map((r: { factory_id: string }) => r.factory_id)
    .filter(Boolean)

  ownerCache.set(user.id, { allowedFactoryIds, expiresAt: Date.now() + OWNER_CACHE_TTL_MS })
  return { userId: user.id, allowedFactoryIds }
}

/** For routes that only need a bearer token string (legacy). */
export { getBearerToken }
