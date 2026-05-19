import { AsyncLocalStorage } from 'async_hooks'
import type { SupabaseClient } from '@supabase/supabase-js'

export type AuthUser = { id: string; email?: string | null }

type DbStore = {
  db: SupabaseClient
  user: AuthUser
}

const storage = new AsyncLocalStorage<DbStore>()

export function runWithDb<T>(db: SupabaseClient, user: AuthUser, fn: () => Promise<T>): Promise<T> {
  return storage.run({ db, user }, fn)
}

export function getServerDb(): SupabaseClient {
  const store = storage.getStore()
  if (!store) throw new Error('Database context not initialized')
  return store.db
}

export function getAuthenticatedUser(): AuthUser {
  const store = storage.getStore()
  if (!store) throw new Error('Database context not initialized')
  return store.user
}
