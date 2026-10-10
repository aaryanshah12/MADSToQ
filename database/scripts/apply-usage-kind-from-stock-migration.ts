/**
 * Copy usage.stock_kind from stock lots; drop usage_entries.stock_kind default.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-usage-kind-from-stock-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyUsageKindFromStockMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/backfill-usage-kind-from-stock.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log('Backfilled usage.stock_kind from stock lots; dropped RM default.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyUsageKindFromStockMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-usage-kind-from-stock-migration.ts') ||
    process.argv[1].endsWith('apply-usage-kind-from-stock-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
