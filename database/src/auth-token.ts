import { getToken, type JWT } from 'next-auth/jwt'
import type { NextRequest } from 'next/server'

/** Match Auth.js cookie names on HTTPS (Render, Vercel, etc.). */
export function useSecureAuthCookies(): boolean {
  const url = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? ''
  if (url.startsWith('https://')) return true
  return process.env.NODE_ENV === 'production'
}

export async function getAuthJwt(request: NextRequest): Promise<JWT | null> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET
  if (!secret) return null
  return getToken({ req: request, secret, secureCookie: useSecureAuthCookies() })
}
