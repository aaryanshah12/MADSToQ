/**
 * Apply FG QC columns on production_batches.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-production-batch-fg-qc-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyProductionBatchFgQcMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-production-batch-fg-qc.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    const parts: string[] = []
    let buf = ''
    let inDo = false
    for (const line of sql.split('\n')) {
      const trimmed = line.trim()
      if (trimmed.startsWith('--') && !inDo) continue
      if (/^DO\s+\$\$/i.test(trimmed)) inDo = true
      buf += `${line}\n`
      if (inDo && /\$\$\s*;\s*$/.test(trimmed)) {
        parts.push(buf.trim())
        buf = ''
        inDo = false
      } else if (!inDo && trimmed.endsWith(';')) {
        parts.push(buf.trim())
        buf = ''
      }
    }
    if (buf.trim()) parts.push(buf.trim())

    for (const stmt of parts) {
      if (!stmt || stmt === ';') continue
      await prisma.$executeRawUnsafe(stmt)
    }
    console.log('Applied production batch FG QC migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyProductionBatchFgQcMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-production-batch-fg-qc-migration.ts') ||
    process.argv[1].endsWith('apply-production-batch-fg-qc-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
