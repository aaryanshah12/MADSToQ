import { QueryBuilder, callRpc, type DbResult } from './query'
import {
  createAuthUser,
  deleteAuthUser,
  findUserById,
  readSession,
  updateAuthPassword,
  type SessionUser,
} from './session'

export type { DbResult }

type AuthResult = {
  data: { user: SessionUser | null }
  error: { message: string; code?: string } | null
}

function authApi(boundUser: SessionUser | null) {
  return {
    async getUser(token?: string): Promise<AuthResult> {
      if (!token) {
        return { data: { user: boundUser }, error: boundUser ? null : { message: 'Not signed in' } }
      }
      const session = await readSession(token)
      if (!session) return { data: { user: null }, error: { message: 'Invalid session' } }
      const user = await findUserById(session.id)
      if (!user) return { data: { user: null }, error: { message: 'Invalid session' } }
      return { data: { user }, error: null }
    },
    admin: {
      async createUser(input: {
        email: string
        password: string
        email_confirm?: boolean
        user_metadata?: Record<string, unknown>
      }) {
        try {
          const user = await createAuthUser(input)
          return { data: { user }, error: null }
        } catch (err) {
          const e = err as { code?: string; message?: string }
          const message = e.code === '23505' ? 'A user with this email already exists' : e.message || 'Could not create user'
          return { data: { user: null }, error: { message } }
        }
      },
      async deleteUser(id: string) {
        try {
          await deleteAuthUser(id)
          return { data: null, error: null }
        } catch (err) {
          const e = err as { message?: string }
          return { data: null, error: { message: e.message || 'Could not delete user' } }
        }
      },
      async updateUserById(id: string, patch: { password?: string; email_confirm?: boolean }) {
        try {
          if (patch.password) await updateAuthPassword(id, patch.password)
          return { data: { user: { id } }, error: null }
        } catch (err) {
          const e = err as { message?: string }
          return { data: { user: null }, error: { message: e.message || 'Could not update user' } }
        }
      },
    },
    /** Present so older call sites that only sign out on the server no-op cleanly. */
    async signOut() {
      return { error: null }
    },
  }
}

export function createDb(user?: SessionUser | null) {
  const userId = user?.id ?? null
  return {
    from(table: string) {
      return new QueryBuilder(table, userId)
    },
    rpc(fn: string, args?: Record<string, unknown>): Promise<DbResult> {
      return callRpc(fn, args ?? {}, userId)
    },
    auth: authApi(user ?? null),
  }
}

export function getAdminDb() {
  return createDb(null)
}

export type DbClient = ReturnType<typeof createDb>

export const adminDb = new Proxy({} as DbClient, {
  get(_target, prop) {
    return (getAdminDb() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
