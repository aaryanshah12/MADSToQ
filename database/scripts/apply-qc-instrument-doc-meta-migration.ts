/**
 * Optional QcInstrument.doc_meta JSON for log-book headers.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-qc-instrument-doc-meta-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyQcInstrumentDocMetaMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-qc-instrument-doc-meta.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    for (const stmt of sql.split(';').map((s) => s.trim()).filter(Boolean)) {
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log('Applied QC instrument doc_meta migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyQcInstrumentDocMetaMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-qc-instrument-doc-meta-migration.ts') ||
    process.argv[1].endsWith('apply-qc-instrument-doc-meta-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
