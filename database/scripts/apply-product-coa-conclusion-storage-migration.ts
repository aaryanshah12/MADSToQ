/**
 * Product COA conclusion and storage condition.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-product-coa-conclusion-storage-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyProductCoaConclusionStorageMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-product-coa-conclusion-storage.sql')
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
    console.log('Product COA conclusion and storage condition added.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyProductCoaConclusionStorageMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-product-coa-conclusion-storage-migration.ts') ||
    process.argv[1].endsWith('apply-product-coa-conclusion-storage-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
