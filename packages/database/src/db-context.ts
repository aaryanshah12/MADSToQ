import { AsyncLocalStorage } from 'async_hooks'
import type { SupabaseClient } from '@supabase/supabase-js'

const storage = new AsyncLocalStorage<SupabaseClient>()

export function runWithDb<T>(db: SupabaseClient, fn: () => Promise<T>): Promise<T> {
  return storage.run(db, fn)
}

export function getServerDb(): SupabaseClient {
  const db = storage.getStore()
  if (!db) throw new Error('Database context not initialized')
  return db
}
