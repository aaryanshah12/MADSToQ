import bcrypt from 'bcryptjs'
import { SignJWT, jwtVerify } from 'jose'
import { getPool } from './pool'

export const SESSION_COOKIE = 'madstoq_session'
const TOKEN_TTL = '7d'

export type SessionUser = { id: string; email: string | null }

function secretKey() {
  const secret = process.env.AUTH_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('Missing AUTH_SECRET (set a long random string in .env.local)')
  }
  return new TextEncoder().encode(secret)
}

export async function signSession(user: SessionUser): Promise<string> {
  return new SignJWT({ email: user.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(TOKEN_TTL)
    .sign(secretKey())
}

export async function readSession(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey())
    if (!payload.sub) return null
    return { id: payload.sub, email: typeof payload.email === 'string' ? payload.email : null }
  } catch {
    return null
  }
}

export async function findUserByEmail(email: string): Promise<(SessionUser & { encrypted_password: string }) | null> {
  const res = await getPool().query(
    `select id, email, encrypted_password from auth.users where lower(email) = lower($1) limit 1`,
    [email]
  )
  return res.rows[0] ?? null
}

export async function findUserById(id: string): Promise<SessionUser | null> {
  const res = await getPool().query(`select id, email from auth.users where id = $1 limit 1`, [id])
  return res.rows[0] ?? null
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash)
}

export async function createAuthUser(input: {
  email: string
  password: string
  user_metadata?: Record<string, unknown>
}): Promise<SessionUser> {
  const hash = await bcrypt.hash(input.password, 10)
  const res = await getPool().query(
    `
    insert into auth.users (email, encrypted_password, raw_user_meta_data)
    values ($1, $2, $3::jsonb)
    returning id, email
    `,
    [input.email, hash, JSON.stringify(input.user_metadata ?? {})]
  )
  return res.rows[0]
}

export async function deleteAuthUser(id: string): Promise<void> {
  await getPool().query(`delete from auth.users where id = $1`, [id])
}

export async function updateAuthPassword(id: string, password: string): Promise<void> {
  const hash = await bcrypt.hash(password, 10)
  await getPool().query(`update auth.users set encrypted_password = $2, updated_at = now() where id = $1`, [id, hash])
}
