import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createDb } from './client'
import { runWithDb, type AuthUser } from './db-context'
import type { DbClient } from './client'
import { findUserById, readSession, SESSION_COOKIE } from './session'

const AUTH_CACHE_TTL_MS = 120_000
const authCache = new Map<string, { user: AuthUser; expiresAt: number }>()

export function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (authHeader?.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim()
    if (token) return token
  }
  return request.cookies.get(SESSION_COOKIE)?.value || null
}

async function resolveUserFromToken(token: string): Promise<AuthUser | null> {
  const cached = authCache.get(token)
  if (cached && Date.now() < cached.expiresAt) return cached.user

  const session = await readSession(token)
  if (!session) return null
  const user = await findUserById(session.id)
  if (!user) return null

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

  const db = createDb(user)
  return { token, user, db }
}

export async function withAuthenticatedDb<T>(
  request: NextRequest,
  handler: (ctx: { user: AuthUser; db: DbClient }) => Promise<T>
): Promise<T | NextResponse> {
  const auth = await requireAuthenticatedUser(request)
  if ('error' in auth && auth.error) return auth.error

  return runWithDb(auth.db, auth.user, () => handler({ user: auth.user, db: auth.db }))
}
