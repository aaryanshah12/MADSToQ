import { AsyncLocalStorage } from 'async_hooks'
import type { DbClient } from './client'
import type { SessionUser } from './session'

export type AuthUser = SessionUser

type DbStore = {
  db: DbClient
  user: AuthUser
}

const storage = new AsyncLocalStorage<DbStore>()

export function runWithDb<T>(db: DbClient, user: AuthUser, fn: () => Promise<T>): Promise<T> {
  return storage.run({ db, user }, fn)
}

export function getServerDb(): DbClient {
  const store = storage.getStore()
  if (!store) throw new Error('Database context not initialized')
  return store.db
}

export function getAuthenticatedUser(): AuthUser {
  const store = storage.getStore()
  if (!store) throw new Error('Database context not initialized')
  return store.user
}
