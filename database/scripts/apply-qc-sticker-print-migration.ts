/**
 * QC sticker print columns on receipts and production batches.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-qc-sticker-print-migration.ts
 */
import '../src/load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyQcStickerPrintMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-qc-sticker-print.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log('Applied QC sticker print migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyQcStickerPrintMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-qc-sticker-print-migration.ts') ||
    process.argv[1].endsWith('apply-qc-sticker-print-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
