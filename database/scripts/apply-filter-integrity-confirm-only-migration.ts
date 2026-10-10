/**
 * Filter integrity: Ok / Not Ok only, no start or end time.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-filter-integrity-confirm-only-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyFilterIntegrityConfirmOnlyMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/filter-integrity-confirm-only.sql')
    const sql = readFileSync(sqlPath, 'utf8')
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n')
    for (const stmt of sql
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log('Filter integrity is confirm-only.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyFilterIntegrityConfirmOnlyMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-filter-integrity-confirm-only-migration.ts') ||
    process.argv[1].endsWith('apply-filter-integrity-confirm-only-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
