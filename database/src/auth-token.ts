import { getToken, type JWT } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

/** Same rule as Auth.js: https uses the __Secure- session cookie. */
export function useSecureAuthCookies(request?: NextRequest): boolean {
  const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? ''
  if (url.startsWith('https://')) return true
  if (url.startsWith('http://')) return false
  const forwarded = request?.headers.get('x-forwarded-proto')?.split(',')[0]?.trim()
  return request?.nextUrl?.protocol === 'https:' || forwarded === 'https'
}

export async function getAuthJwt(request: NextRequest): Promise<JWT | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) return null
  return getToken({ req: request, secret, secureCookie: useSecureAuthCookies(request) })
}
