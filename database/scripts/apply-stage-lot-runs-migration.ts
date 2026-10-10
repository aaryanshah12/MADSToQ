/**
 * Apply stage lot-run columns (repeat process stage per multi-lot RM).
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-stage-lot-runs-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyStageLotRunsMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-stage-lot-runs.sql')
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
    console.log('Applied stage lot-runs migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyStageLotRunsMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-stage-lot-runs-migration.ts') ||
    process.argv[1].endsWith('apply-stage-lot-runs-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
