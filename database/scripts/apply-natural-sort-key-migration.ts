/**
 * Serial-number sort key used by paginated lists.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-natural-sort-key-migration.ts
 */
import './load-env.js'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '../src/generated/client'

const __dirname = dirname(fileURLToPath(import.meta.url))

/** Split on semicolons that are outside dollar-quoted function bodies. */
function splitSqlStatements(sql: string) {
  const statements: string[] = []
  let current = ''
  let i = 0
  let dollarTag: string | null = null
  while (i < sql.length) {
    if (dollarTag) {
      const end = sql.indexOf(dollarTag, i)
      if (end === -1) {
        current += sql.slice(i)
        break
      }
      current += sql.slice(i, end + dollarTag.length)
      i = end + dollarTag.length
      dollarTag = null
      continue
    }
    const tag = /^\$[A-Za-z0-9_]*\$/.exec(sql.slice(i))
    if (sql[i] === '$' && tag) {
      dollarTag = tag[0]
      current += tag[0]
      i += tag[0].length
      continue
    }
    if (sql[i] === ';') {
      const statement = current.trim()
      if (statement) statements.push(statement)
      current = ''
      i += 1
      continue
    }
    current += sql[i]
    i += 1
  }
  const tail = current.trim()
  if (tail) statements.push(tail)
  return statements
}

export async function applyNaturalSortKeyMigration() {
  const prisma = new PrismaClient()
  try {
    const sqlPath = join(__dirname, '../sql/migrations/add-natural-sort-key.sql')
    const sql = readFileSync(sqlPath, 'utf8')
    for (const stmt of splitSqlStatements(sql)) {
      const executable = stmt.replace(/^--[^\n]*\n/gm, '').trim()
      if (!executable || executable.startsWith('--')) continue
      await prisma.$executeRawUnsafe(executable)
    }
    console.log('Applied natural sort key migration.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyNaturalSortKeyMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-natural-sort-key-migration.ts') ||
    process.argv[1].endsWith('apply-natural-sort-key-migration.js'))

if (isMain) {
  main().catch((error) => {
    console.error(error)
    process.exit(1)
  })
}
