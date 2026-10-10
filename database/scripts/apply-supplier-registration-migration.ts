/**
 * F/PUR/04 supplier registration columns.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-supplier-registration-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applySupplierRegistrationMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-supplier-registration.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log('Applied supplier registration migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applySupplierRegistrationMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-supplier-registration-migration.ts') ||
    process.argv[1].endsWith('apply-supplier-registration-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
