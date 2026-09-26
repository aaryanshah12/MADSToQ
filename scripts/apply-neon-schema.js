/**
 * Apply the Neon schema files in order.
 * Usage: node scripts/apply-neon-schema.js [start-file]
 * Reads DATABASE_URL from .env.local.
 */
const fs = require('fs')
const path = require('path')
const { Pool } = require('pg')

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

function databaseUrl() {
  const raw = process.env.DATABASE_URL
  if (!raw) throw new Error('Missing DATABASE_URL')
  const url = new URL(raw)
  url.hostname = url.hostname.replace('-pooler', '')
  url.searchParams.delete('channel_binding')
  return url.toString()
}

const FILES = [
  'database/sql/neon/00-auth.sql',
  'database/sql/supabase-schema.sql',
  'database/sql/sales-schema.sql',
  'database/sql/pmc-schema.sql',
  'database/sql/io-pdf-config.sql',
  'database/sql/neon/10-app-tables.sql',
  'database/sql/neon/90-grants.sql',
]

async function main() {
  loadEnvLocal()
  const start = process.argv[2]
  const startAt = start ? FILES.indexOf(start) : 0
  if (start && startAt === -1) {
    console.error(`Unknown file: ${start}`)
    process.exit(1)
  }
  const files = FILES.slice(startAt)
  const pool = new Pool({ connectionString: databaseUrl(), ssl: { rejectUnauthorized: false } })
  const root = path.join(__dirname, '..')
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(root, file), 'utf8')
      process.stdout.write(`Applying ${file}...\n`)
      await pool.query(sql)
      process.stdout.write(`  ok\n`)
    }
    const tables = await pool.query(
      `select count(*)::int as n from information_schema.tables where table_schema = 'public'`
    )
    process.stdout.write(`Public tables: ${tables.rows[0].n}\n`)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
