import { AsyncLocalStorage } from 'async_hooks'
import { prisma, type PrismaClient } from './prisma'
import { createPostgrestClient, type PostgrestClient } from './postgrest-client'

const storage = new AsyncLocalStorage<PrismaClient>()

export function runWithDb<T>(db: PrismaClient, fn: () => Promise<T>): Promise<T> {
  return storage.run(db, fn)
}

export function getPrisma(): PrismaClient {
  return storage.getStore() ?? prisma
}

/** @deprecated PostgREST shim — IO now uses Prisma; kept for reference only. */
export function getServerDb(): PostgrestClient {
  return createPostgrestClient(getPrisma())
}
