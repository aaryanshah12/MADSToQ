import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

/** Service-role client — server-side API routes only. */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_admin) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }
    _admin = createClient(url, key)
  }
  return _admin
}

/** @deprecated Use getSupabaseAdmin() */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getSupabaseAdmin() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
