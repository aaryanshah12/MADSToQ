/**
 * Signed COA PDF stored per dispatch lot.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-signed-coa-pdf-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applySignedCoaPdfMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-signed-coa-pdf.sql')
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
    console.log('Signed COA PDF table added.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applySignedCoaPdfMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-signed-coa-pdf-migration.ts') ||
    process.argv[1].endsWith('apply-signed-coa-pdf-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
