import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@madstoq/database'
import { createUserSupabase } from './create-user-supabase'
import { runWithDb } from './db-context'
import type { SupabaseClient } from '@supabase/supabase-js'

export function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return null
  return authHeader.slice(7).trim() || null
}

export async function requireAuthenticatedUser(request: NextRequest) {
  const token = getBearerToken(request)
  if (!token) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const db = createUserSupabase(token)
  return { token, user: data.user, db }
}

export async function withAuthenticatedDb<T>(
  request: NextRequest,
  handler: (ctx: { user: { id: string; email?: string | null }; db: SupabaseClient }) => Promise<T>
): Promise<T | NextResponse> {
  const auth = await requireAuthenticatedUser(request)
  if ('error' in auth && auth.error) return auth.error

  return runWithDb(auth.db, () => handler({ user: auth.user, db: auth.db }))
}
