import { NextResponse } from 'next/server'
import { findUserByEmail, SESSION_COOKIE, signSession, verifyPassword } from '@madstoq/database'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json()
    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 })
    }

    const user = await findUserByEmail(String(email))
    if (!user || !(await verifyPassword(String(password), user.encrypted_password))) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 })
    }

    const sessionUser = { id: user.id, email: user.email }
    const access_token = await signSession(sessionUser)
    const response = NextResponse.json({
      access_token,
      user: sessionUser,
    })
    response.cookies.set(SESSION_COOKIE, access_token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 60 * 60 * 24 * 7,
    })
    return response
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign-in failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
