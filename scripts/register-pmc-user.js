/**
 * Grant PMC Portal access via the pmc_users allowlist.
 *
 * Existing account, allowlist only:
 *   node scripts/register-pmc-user.js owner@factory.com --allowlist-only 'Factory Owner'
 *
 * Create an account or reset the password:
 *   node scripts/register-pmc-user.js owner@factory.com 'NewPass123' 'Factory Owner'
 *
 * Requires DATABASE_URL in .env.local.
 */

const fs = require('fs')
const path = require('path')
const bcrypt = require('bcryptjs')
const { Pool } = require('pg')

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', '.env.local')
  if (!fs.existsSync(envPath)) return
  const text = fs.readFileSync(envPath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (!process.env[key]) process.env[key] = val
  }
}

function databaseUrl() {
  const raw = process.env.DATABASE_URL
  if (!raw) return null
  const url = new URL(raw)
  url.hostname = url.hostname.replace('-pooler', '')
  url.searchParams.delete('channel_binding')
  return url.toString()
}

function parseArgs(argv) {
  const allowlistOnly = argv.includes('--allowlist-only')
  const filtered = argv.filter((a) => a !== '--allowlist-only')
  const email = filtered[2]
  const passwordArg = filtered[3]
  const fullName = filtered[4] || 'PMC User'
  const allowlistOnlyMode =
    allowlistOnly || passwordArg === '' || passwordArg === undefined || passwordArg === '--allowlist-only'
  return { email, password: allowlistOnlyMode ? null : passwordArg, fullName, allowlistOnlyMode }
}

async function main() {
  loadEnvLocal()
  const { email, password, fullName, allowlistOnlyMode } = parseArgs(process.argv)

  if (!email) {
    console.error(
      'Usage: node scripts/register-pmc-user.js <email> [password|--allowlist-only] [fullName]'
    )
    process.exit(1)
  }

  const connectionString = databaseUrl()
  if (!connectionString) {
    console.error('Missing DATABASE_URL in .env.local')
    process.exit(1)
  }

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } })
  try {
    const existing = await pool.query(
      `select id from auth.users where lower(email) = lower($1) limit 1`,
      [email]
    )
    let userId = existing.rows[0]?.id ?? null

    if (allowlistOnlyMode) {
      if (!userId) {
        console.error(`No account found for ${email}. Pass a password to create one.`)
        process.exit(1)
      }
      console.log('Account found — adding PMC allowlist only (password unchanged).')
    } else if (userId) {
      console.log('Account exists — updating password and PMC allowlist…')
      const hash = await bcrypt.hash(password, 10)
      await pool.query(
        `update auth.users set encrypted_password = $2, updated_at = now() where id = $1`,
        [userId, hash]
      )
    } else {
      console.log('Creating account and PMC allowlist…')
      const hash = await bcrypt.hash(password, 10)
      const created = await pool.query(
        `insert into auth.users (email, encrypted_password, raw_user_meta_data)
         values ($1, $2, $3::jsonb)
         returning id`,
        [email, hash, JSON.stringify({ full_name: fullName, role: 'owner' })]
      )
      userId = created.rows[0].id
    }

    await pool.query(
      `insert into pmc_users (user_id, full_name, email, is_active)
       values ($1, $2, $3, true)
       on conflict (user_id) do update
         set full_name = excluded.full_name,
             email = excluded.email,
             is_active = true`,
      [userId, fullName, email]
    )
    console.log('Done.')
    console.log('  email:   ', email)
    console.log('  user id: ', userId)
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
