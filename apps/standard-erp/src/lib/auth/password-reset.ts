import { createHash, randomBytes } from 'node:crypto'
import { hash } from 'bcryptjs'
import { prisma } from '@madstoq/database'
import { resetPathForReturn, sanitizeReturnTo } from '@/lib/auth/password-reset-paths'

const TOKEN_BYTES = 32
const TOKEN_TTL_MS = 60 * 60 * 1000

export function hashResetToken(raw: string): string {
  return createHash('sha256').update(raw).digest('hex')
}

export function createRawResetToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url')
}

export async function issuePasswordResetToken(userId: string): Promise<string> {
  const raw = createRawResetToken()
  const tokenHash = hashResetToken(raw)
  const expiresAt = new Date(Date.now() + TOKEN_TTL_MS)

  await prisma.$transaction([
    prisma.passwordResetToken.deleteMany({ where: { userId, usedAt: null } }),
    prisma.passwordResetToken.create({
      data: { userId, tokenHash, expiresAt },
    }),
  ])

  return raw
}

export async function consumePasswordResetToken(
  rawToken: string,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (newPassword.length < 8) {
    return { ok: false, error: 'Password must be at least 8 characters' }
  }

  const tokenHash = hashResetToken(rawToken)
  const row = await prisma.passwordResetToken.findUnique({
    where: { tokenHash },
    include: { user: { select: { id: true, isActive: true } } },
  })

  if (!row || row.usedAt) {
    return { ok: false, error: 'Invalid or expired reset link' }
  }
  if (row.expiresAt.getTime() < Date.now()) {
    return { ok: false, error: 'Reset link has expired' }
  }
  if (!row.user.isActive) {
    return { ok: false, error: 'Account is inactive' }
  }

  const passwordHash = await hash(newPassword, 12)

  await prisma.$transaction([
    prisma.user.update({
      where: { id: row.userId },
      data: { passwordHash },
    }),
    prisma.passwordResetToken.update({
      where: { id: row.id },
      data: { usedAt: new Date() },
    }),
  ])

  return { ok: true }
}

export function buildResetUrl(rawToken: string, returnTo: string): string {
  const base = process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
  const safeReturn = sanitizeReturnTo(returnTo)
  const params = new URLSearchParams({
    token: rawToken,
    returnTo: safeReturn,
  })
  return `${base.replace(/\/$/, '')}${resetPathForReturn(safeReturn)}?${params.toString()}`
}
