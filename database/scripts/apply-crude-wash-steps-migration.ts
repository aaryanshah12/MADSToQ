/**
 * Wash start/end JSON on production batch stage logs.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-crude-wash-steps-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyCrudeWashStepsMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-crude-wash-steps.sql')
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
    console.log('Applied crude wash steps migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyCrudeWashStepsMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-crude-wash-steps-migration.ts') ||
    process.argv[1].endsWith('apply-crude-wash-steps-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
