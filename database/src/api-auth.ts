import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from './supabase-admin'
import { createUserSupabase } from './create-user-supabase'
import { runWithDb, type AuthUser } from './db-context'
import type { SupabaseClient } from '@supabase/supabase-js'

const AUTH_CACHE_TTL_MS = 120_000
const authCache = new Map<string, { user: AuthUser; expiresAt: number }>()

export function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return null
  return authHeader.slice(7).trim() || null
}

async function resolveUserFromToken(token: string): Promise<AuthUser | null> {
  const cached = authCache.get(token)
  if (cached && Date.now() < cached.expiresAt) return cached.user

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) return null

  const user: AuthUser = { id: data.user.id, email: data.user.email }
  authCache.set(token, { user, expiresAt: Date.now() + AUTH_CACHE_TTL_MS })
  return user
}

export async function requireAuthenticatedUser(request: NextRequest) {
  const token = getBearerToken(request)
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const user = await resolveUserFromToken(token)
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const db = createUserSupabase(token)
  return { token, user, db }
}

export async function withAuthenticatedDb<T>(
  request: NextRequest,
  handler: (ctx: { user: AuthUser; db: SupabaseClient }) => Promise<T>
): Promise<T | NextResponse> {
  const auth = await requireAuthenticatedUser(request)
  if ('error' in auth && auth.error) return auth.error

  return runWithDb(auth.db, auth.user, () => handler({ user: auth.user, db: auth.db }))
}
