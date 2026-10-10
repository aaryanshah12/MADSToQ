/**
 * Legacy package — Supabase removed. Auth uses Auth.js + Neon (Prisma).
 * Kept so old imports do not break; all helpers are no-ops.
 */

export function isSupabaseConfigured(): boolean {
  return false
}

export function getAuthClient(): null {
  return null
}

/** @deprecated Supabase removed */
export const authClient = {
  auth: {
    signOut: async () => ({ error: null }),
    setSession: async () => ({ data: { session: null }, error: null }),
    getSession: async () => ({ data: { session: null }, error: null }),
  },
  channel: () => ({
    on: function () {
      return this
    },
    subscribe: function () {
      return this
    },
  }),
  removeChannel: () => {},
}
