/**
 * Rename fg_sales → dispatch_schedules (same table, FG + byproduct).
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-rename-fg-sales-to-dispatch-schedules-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

export async function applyRenameFgSalesToDispatchSchedulesMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(
      __dirname,
      '../sql/migrations/rename-fg-sales-to-dispatch-schedules.sql',
    )
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
    console.log('Renamed fg_sales tables to dispatch_schedules.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyRenameFgSalesToDispatchSchedulesMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-rename-fg-sales-to-dispatch-schedules-migration.ts') ||
    process.argv[1].endsWith('apply-rename-fg-sales-to-dispatch-schedules-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
