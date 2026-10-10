/**
 * Add requires_qc on production_output_fields.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-production-output-requires-qc-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyProductionOutputRequiresQcMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-production-output-requires-qc.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log('Applied production output requires_qc migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyProductionOutputRequiresQcMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-production-output-requires-qc-migration.ts') ||
    process.argv[1].endsWith('apply-production-output-requires-qc-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
