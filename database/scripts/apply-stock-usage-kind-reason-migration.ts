/**
 * Add usage stock_kind / usage_reason; backfill byproduct lots from /BP/.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-stock-usage-kind-reason-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyStockUsageKindReasonMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-stock-usage-kind-reason.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log('Applied stock/usage kind + reason migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyStockUsageKindReasonMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-stock-usage-kind-reason-migration.ts') ||
    process.argv[1].endsWith('apply-stock-usage-kind-reason-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
