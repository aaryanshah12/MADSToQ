import './load-env'
import { existsSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from './generated/client'
import { fieldEncryptionExtension } from './prisma-extension'

/** Point Prisma at the engine binary. Bundled server functions do not sit next to it. */
function configureQueryEngine() {
  const current = process.env.PRISMA_QUERY_ENGINE_LIBRARY
  if (current && existsSync(current)) return

  const here = path.dirname(fileURLToPath(import.meta.url))
  const dirs = [
    path.join(here, 'generated/client'),
    path.join(process.cwd(), 'database/src/generated/client'),
    path.join(process.cwd(), '../../database/src/generated/client'),
    path.join(process.cwd(), 'src/generated/client'),
  ]
  const platformHint =
    process.platform === 'linux'
      ? 'rhel-openssl-3.0.x'
      : process.platform === 'darwin'
        ? `darwin-${process.arch}`
        : ''

  for (const dir of dirs) {
    if (!existsSync(dir)) continue
    let names: string[] = []
    try {
      names = readdirSync(dir)
    } catch {
      continue
    }
    const engines = names.filter((name) => name.startsWith('libquery_engine-') && name.endsWith('.node'))
    const match = (platformHint && engines.find((name) => name.includes(platformHint))) || engines[0]
    if (!match) continue
    process.env.PRISMA_QUERY_ENGINE_LIBRARY = path.join(dir, match)
    return
  }
}

configureQueryEngine()

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
