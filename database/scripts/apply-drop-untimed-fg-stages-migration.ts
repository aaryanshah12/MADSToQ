/**
 * Remove timed "Collect in vessel" and "Finish received" process stages.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-drop-untimed-fg-stages-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyDropUntimedFgStagesMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/drop-untimed-fg-stages.sql')
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
    console.log('Removed Collect in vessel and Finish received stages.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyDropUntimedFgStagesMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-drop-untimed-fg-stages-migration.ts') ||
    process.argv[1].endsWith('apply-drop-untimed-fg-stages-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
