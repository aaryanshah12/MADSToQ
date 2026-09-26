import type { NextRequest } from 'next/server'
import { requireAuthenticatedUser } from '@madstoq/database'
import type { SalesUser, SalesOrg } from './types/index'

/**
 * Verifies the caller is signed in and provisioned in sales_users,
 * and loads their org and membership.
 */
export async function getSalesContext(request: NextRequest) {
  const auth = await requireAuthenticatedUser(request)
  if ('error' in auth && auth.error) {
    return { ok: false as const, status: 401, error: 'Not signed in' }
  }

  const { data: rows, error } = await auth.db
    .from('sales_users')
    .select('*, org:sales_orgs(*)')
    .eq('user_id', auth.user.id)
    .eq('is_active', true)
    .limit(1)

  if (error) return { ok: false as const, status: 500, error: error.message }
  const row = (rows ?? [])[0] as any
  if (!row) return { ok: false as const, status: 403, error: 'No sales access' }

  return {
    ok: true as const,
    db: auth.db,
    user: { id: auth.user.id, email: auth.user.email ?? null },
    membership: { ...row, org: undefined } as SalesUser,
    org: row.org as SalesOrg,
  }
}
