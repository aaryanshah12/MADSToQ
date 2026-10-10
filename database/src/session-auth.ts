import type { NextRequest } from 'next/server'
import { getAuthJwt } from './auth-token'

/** Resolve signed-in user id from Auth.js session cookie. */
export async function getSessionUserId(request: NextRequest): Promise<string | null> {
  const token = await getAuthJwt(request)
  return typeof token?.sub === 'string' && token.sub.length > 0 ? token.sub : null
}
