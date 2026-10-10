import '@/load-root-env'
import { NextResponse } from 'next/server'
import { normalizeEmail, parseEmail, prisma } from '@madstoq/database'
import { sendPasswordResetEmail } from '@/lib/email/auth-mailer'
import { buildResetUrl, issuePasswordResetToken } from '@/lib/auth/password-reset'
import { sanitizeReturnTo } from '@/lib/auth/password-reset-paths'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const FORGOT_LIMIT = 3
const FORGOT_WINDOW_MS = 60 * 60 * 1000
const forgotAttempts = new Map<string, number[]>()

function checkRateLimit(key: string): boolean {
  const now = Date.now()
  const windowStart = now - FORGOT_WINDOW_MS
  const times = (forgotAttempts.get(key) ?? []).filter((t) => t > windowStart)
  if (times.length >= FORGOT_LIMIT) return false
  times.push(now)
  forgotAttempts.set(key, times)
  return true
}

const OK = NextResponse.json({ ok: true })

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; returnTo?: string }
    const parsed = parseEmail(body.email ?? '')
    if (!parsed) {
      return OK
    }

    if (!checkRateLimit(parsed)) {
      return OK
    }

    const user = await prisma.user.findFirst({
      where: { email: parsed, isActive: true },
      select: { id: true, email: true },
    })

    if (!user?.email) {
      return OK
    }

    const returnTo = sanitizeReturnTo(
      typeof body.returnTo === 'string' ? body.returnTo : undefined,
    )

    const rawToken = await issuePasswordResetToken(user.id)
    const resetUrl = buildResetUrl(rawToken, returnTo)

    await sendPasswordResetEmail({
      to: normalizeEmail(user.email),
      resetUrl,
      appName: process.env.NEXT_PUBLIC_APP_NAME ?? 'MADSTOQ ERP',
    })

    return OK
  } catch (err) {
    console.error('[forgot-password]', err)
    return OK
  }
}
