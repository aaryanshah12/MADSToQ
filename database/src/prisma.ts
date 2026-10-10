import './load-env'
import { PrismaClient } from './generated/client'
import { fieldEncryptionExtension } from './prisma-extension'

/** Bump when `prisma generate` adds fields that must replace a hot-reloaded client. */
const PRISMA_CLIENT_REVISION = 'list-roundtrip-v2'

const globalForPrisma = globalThis as unknown as {
  prisma?: ReturnType<typeof createPrismaClient>
  prismaClientRevision?: string
}

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  }).$extends(fieldEncryptionExtension)
}

export type AppPrismaClient = ReturnType<typeof createPrismaClient>
export type PrismaClient = AppPrismaClient

function getOrCreatePrisma() {
  const existing = globalForPrisma.prisma
  // After `prisma generate`, a hot-reloaded process can keep an old client
  // missing new model delegates / fields (e.g. requiresQc on outputs).
  if (
    existing &&
    globalForPrisma.prismaClientRevision === PRISMA_CLIENT_REVISION &&
    typeof (existing as { inventoryNumberingConfig?: unknown }).inventoryNumberingConfig
      ?.findMany === 'function'
  ) {
    return existing
  }
  const client = createPrismaClient()
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = client
    globalForPrisma.prismaClientRevision = PRISMA_CLIENT_REVISION
  }
  return client
}

export const prisma = getOrCreatePrisma()
