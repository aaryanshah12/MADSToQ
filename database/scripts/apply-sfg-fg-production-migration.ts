/**
 * SFG numbering, product/batch kinds, warehouse stock_kind, discounted FG sales.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-sfg-fg-production-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applySfgFgProductionMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-sfg-fg-production.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log('Applied SFG/FG production migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applySfgFgProductionMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-sfg-fg-production-migration.ts') ||
    process.argv[1].endsWith('apply-sfg-fg-production-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
