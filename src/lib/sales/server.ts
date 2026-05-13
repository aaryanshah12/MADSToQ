import { cookies } from 'next/headers'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import type { SalesUser, SalesOrg } from './types'

/**
 * Helper used inside Sales API routes to verify the caller is signed in,
 * provisioned in `sales_users`, and to load their org and membership in one go.
 */
export async function getSalesContext() {
  const supabase = createRouteHandlerClient({ cookies })
  const { data: authData } = await supabase.auth.getUser()
  const auth = authData.user
  if (!auth) return { ok: false as const, status: 401, error: 'Not signed in', supabase }

  const { data: rows, error } = await supabase
    .from('sales_users')
    .select('*, org:sales_orgs(*)')
    .eq('user_id', auth.id)
    .eq('is_active', true)
    .limit(1)

  if (error) return { ok: false as const, status: 500, error: error.message, supabase }
  const row = (rows ?? [])[0] as any
  if (!row) return { ok: false as const, status: 403, error: 'No sales access', supabase }

  return {
    ok: true as const,
    supabase,
    user: { id: auth.id, email: auth.email ?? null },
    membership: { ...row, org: undefined } as SalesUser,
    org: row.org as SalesOrg,
  }
}
