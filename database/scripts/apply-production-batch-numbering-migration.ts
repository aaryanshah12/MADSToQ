/**
 * Batch numbering (seq/AFC/FY) + mfg_date / purity on production_batches.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-production-batch-numbering-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyProductionBatchNumberingMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-production-batch-numbering.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log('Applied production batch numbering migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyProductionBatchNumberingMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-production-batch-numbering-migration.ts') ||
    process.argv[1].endsWith('apply-production-batch-numbering-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
