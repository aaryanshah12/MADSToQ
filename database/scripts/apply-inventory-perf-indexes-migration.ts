/**
 * Inventory list/QC indexes (factory+status, lot_invoice).
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-inventory-perf-indexes-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyInventoryPerfIndexesMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-inventory-perf-indexes.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log('Applied inventory performance indexes migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyInventoryPerfIndexesMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-inventory-perf-indexes-migration.ts') ||
    process.argv[1].endsWith('apply-inventory-perf-indexes-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
