/**
 * RM QC reject dispositions (discount accept / return to vendor).
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-rm-reject-disposition-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyRmRejectDispositionMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-rm-reject-disposition.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log('Applied RM reject disposition migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyRmRejectDispositionMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-rm-reject-disposition-migration.ts') ||
    process.argv[1].endsWith('apply-rm-reject-disposition-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
