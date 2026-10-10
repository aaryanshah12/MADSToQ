import type { NextRequest } from 'next/server'
import { getAuthJwt, prisma } from '@madstoq/database'
import type { SalesUser, SalesOrg } from './types'

async function resolveSessionUser(request: NextRequest): Promise<{ id: string; email: string | null } | null> {
  const token = await getAuthJwt(request)
  if (typeof token?.sub === 'string' && token.sub.length > 0) {
    return { id: token.sub, email: (token.email as string | null | undefined) ?? null }
  }
  return null
}

type SalesUserRow = SalesUser & { org: SalesOrg }

export type SalesContextResult =
  | {
      ok: true
      db: typeof prisma
      user: { id: string; email: string | null }
      membership: SalesUser
      org: SalesOrg
    }
  | { ok: false; status: number; error: string }

/**
 * Resolves Auth.js session and loads sales_users + sales_orgs from Neon (Prisma).
 */
export async function getSalesContext(request: NextRequest): Promise<SalesContextResult> {
  const sessionUser = await resolveSessionUser(request)
  if (!sessionUser) {
    return { ok: false, status: 401, error: 'Not signed in' }
  }

  try {
    const rows = await prisma.$queryRaw<SalesUserRow[]>`
      SELECT
        su.id,
        su.user_id,
        su.org_id,
        su.full_name,
        su.email,
        su.phone,
        su.is_active,
        su.created_at,
        su.updated_at,
        json_build_object(
          'id', so.id,
          'name', so.name,
          'slug', so.slug,
          'email_from', so.email_from,
          'email_cc', so.email_cc,
          'is_active', so.is_active,
          'created_at', so.created_at,
          'updated_at', so.updated_at
        ) AS org
      FROM sales_users su
      INNER JOIN sales_orgs so ON so.id = su.org_id
      WHERE su.user_id::text = ${sessionUser.id}
        AND su.is_active = true
        AND so.is_active = true
      LIMIT 1
    `

    const row = rows[0]
    if (!row) return { ok: false, status: 403, error: 'No sales access' }

    const { org, ...membership } = row
    return {
      ok: true,
      db: prisma,
      user: sessionUser,
      membership: membership as SalesUser,
      org: org as SalesOrg,
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Database error'
    if (message.includes('does not exist') || message.includes('relation')) {
      return {
        ok: false,
        status: 503,
        error: 'Sales tables not provisioned on Neon. Run database/supabase/sales-schema.sql in Neon SQL Editor.',
      }
    }
    return { ok: false, status: 500, error: message }
  }
}
