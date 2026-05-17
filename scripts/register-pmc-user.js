/**
 * Grant PMC Portal access via pmc_users allowlist.
 *
 * For users who ALREADY exist in Supabase Auth (other portals), omit password:
 *   node scripts/register-pmc-user.js owner@factory.com '' 'Factory Owner'
 *   node scripts/register-pmc-user.js owner@factory.com --allowlist-only 'Factory Owner'
 *
 * To also create Auth or reset password, pass a password:
 *   node scripts/register-pmc-user.js owner@factory.com 'NewPass123' 'Factory Owner'
 *
 * Requires .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

const fs = require('fs')
const path = require('path')
const { createClient } = require('@supabase/supabase-js')

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

async function findUserIdByEmail(admin, email) {
  let page = 1
  const perPage = 200
  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage })
    if (error) throw error
    const match = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (match) return match.id
    if (data.users.length < perPage) break
    page += 1
  }
  return null
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
      'Usage: node scripts/register-pmc-user.js <email> [password|--allowlist-only] [fullName]\n' +
        '  Existing auth user (other portals): omit password or use --allowlist-only\n' +
        '  New auth user: pass password as second argument'
    )
    process.exit(1)
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
  }

  const admin = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  let userId = await findUserIdByEmail(admin, email)

  if (allowlistOnlyMode) {
    if (!userId) {
      console.error(
        `No auth user found for ${email}. Create them in Supabase Authentication first, or pass a password to create the account.`
      )
      process.exit(1)
    }
    console.log('Auth user found — adding PMC allowlist only (password unchanged).')
  } else if (userId) {
    console.log('Auth user exists — updating password and PMC allowlist…')
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password,
      email_confirm: true,
    })
    if (error) throw error
  } else {
    console.log('Creating auth user and PMC allowlist…')
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (error) throw error
    userId = data.user.id
  }

  const { error: pmcError } = await admin.from('pmc_users').upsert(
    {
      user_id: userId,
      full_name: fullName,
      email,
      is_active: true,
    },
    { onConflict: 'user_id' }
  )
  if (pmcError) throw pmcError

  console.log('Done.')
  console.log(`  Email:    ${email}`)
  console.log(`  User ID:  ${userId}`)
  console.log('  Sign in at /pmc with the same email/password used for other portals.')
}

main().catch((err) => {
  console.error(err.message || err)
  process.exit(1)
})
