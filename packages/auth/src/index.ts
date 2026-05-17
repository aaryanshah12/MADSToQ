/**
 * Browser Supabase client — authentication and realtime only.
 * Do not use .from() or .rpc(); all data access goes through /api routes.
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

export function getAuthClient(): SupabaseClient {
  if (!_client) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY')
    }
    _client = createClient(supabaseUrl, supabaseAnonKey)
  }
  return _client
}

/** Lazy singleton — safe to import during build; initialized on first use. */
export const authClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    return (getAuthClient() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
