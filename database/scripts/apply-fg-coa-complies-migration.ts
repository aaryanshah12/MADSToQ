/**
 * Finished-goods Description and Identification comply / does not comply.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-fg-coa-complies-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyFgCoaCompliesMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-fg-coa-complies.sql')
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
    console.log('Finished-goods comply results added.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyFgCoaCompliesMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-fg-coa-complies-migration.ts') ||
    process.argv[1].endsWith('apply-fg-coa-complies-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
