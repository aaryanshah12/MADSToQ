/**
 * Print Neon host + auth schema status for the DB in database/.env or shell exports.
 *
 *   cd database && pnpm db:verify:auth
 */
import './load-env.js'
import { requireDatabaseEnv } from './load-env.js'
import { PrismaClient } from '../src/generated/client'

function hostFromUrl(url: string): string {
  return url.match(/@([^/?]+)/)?.[1] ?? '(unknown)'
}

async function main() {
  const { databaseUrl } = requireDatabaseEnv()
  console.log('Terminal DATABASE_URL host:', hostFromUrl(databaseUrl))
  console.log('Compare this ep-XXXX… host with Neon → Connect on the project you use in SQL Editor.\n')

  const prisma = new PrismaClient()
  try {
    const usernameCol = await prisma.$queryRaw<{ column_name: string }[]>`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'username'
    `
    const resetTable = await prisma.$queryRaw<{ exists: boolean }[]>`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'password_reset_tokens'
      ) AS exists
    `
    const user = await prisma.$queryRaw<
      { email: string | null; has_username: boolean }[]
    >`
      SELECT email,
        EXISTS (
          SELECT 1 FROM information_schema.columns c
          WHERE c.table_schema = 'public' AND c.table_name = 'users' AND c.column_name = 'username'
        ) AS has_username
      FROM users
      WHERE email = 'vib578384@gmail.com'
      LIMIT 1
    `

    console.log('users.username column:', usernameCol.length > 0 ? 'YES' : 'NO')
    console.log('password_reset_tokens table:', resetTable[0]?.exists ? 'YES' : 'NO')
    if (user.length > 0) {
      console.log('VIB contact email row:', user[0].email, '(username column:', user[0].has_username ? 'present' : 'missing', ')')
    } else {
      console.log('VIB contact email row: NOT FOUND (vib578384@gmail.com)')
    }
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
