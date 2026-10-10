import '@/load-root-env'
import { NextResponse } from 'next/server'
import { consumePasswordResetToken } from '@/lib/auth/password-reset'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string; password?: string }
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!token || !password) {
      return NextResponse.json({ error: 'Token and password are required' }, { status: 400 })
    }

    const result = await consumePasswordResetToken(token, password)
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Reset failed'
    console.error('[reset-password]', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
