/**
 * Add sum_of on production_output_fields (computed finish totals).
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-production-output-sum-of-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyProductionOutputSumOfMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-production-output-sum-of.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log('Applied production output sum_of migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyProductionOutputSumOfMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-production-output-sum-of-migration.ts') ||
    process.argv[1].endsWith('apply-production-output-sum-of-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
