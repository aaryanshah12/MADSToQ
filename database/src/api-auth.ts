import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getAuthJwt } from './auth-token'
import { prisma, type PrismaClient } from './prisma'
import { runWithDb } from './db-context'
import { runWithUser } from './request-context'

export function getBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization')
  if (!authHeader?.toLowerCase().startsWith('bearer ')) return null
  return authHeader.slice(7).trim() || null
}

export async function requireAuthenticatedUser(request: NextRequest) {
  const secret = process.env.AUTH_SECRET
  if (secret) {
    const jwt = await getAuthJwt(request)
    if (typeof jwt?.sub === 'string' && jwt.sub.length > 0) {
      return {
        token: null,
        user: { id: jwt.sub, email: (jwt.email as string | null | undefined) ?? null },
        db: prisma,
      }
    }
  }

  return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
}

export async function withAuthenticatedDb<T>(
  request: NextRequest,
  handler: (ctx: { user: { id: string; email?: string | null }; db: PrismaClient }) => Promise<T>
): Promise<T | NextResponse> {
  const auth = await requireAuthenticatedUser(request)
  if ('error' in auth && auth.error) return auth.error

  return runWithDb(auth.db, () =>
    runWithUser({ id: auth.user.id, email: auth.user.email ?? null }, () =>
      handler({ user: auth.user, db: auth.db })
    )
  )
}
