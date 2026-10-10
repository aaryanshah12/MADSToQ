/**
 * Apply username + password_reset_tokens when DB was created from SQL (not Prisma migrate).
 *
 *   cd database && pnpm db:migrate:auth
 *
 * See also: database/sql/migrations/add-user-username-password-reset.sql
 */
import './load-env.js'
import { PrismaClient } from '../src/generated/client'

const STATEMENTS = [
  `ALTER TABLE users ADD COLUMN IF NOT EXISTS username text`,
  `CREATE UNIQUE INDEX IF NOT EXISTS users_username_key ON users (username) WHERE username IS NOT NULL`,
  `UPDATE users SET username = email WHERE username IS NULL`,
  `CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id          text primary key,
    user_id     text not null references users(id) on delete cascade,
    token_hash  text not null unique,
    expires_at  timestamptz not null,
    used_at     timestamptz,
    created_at  timestamptz not null default now()
  )`,
  `CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx ON password_reset_tokens (user_id)`,
]

export async function applyAuthMigration() {
  const prisma = new PrismaClient()
  try {
    for (const sql of STATEMENTS) {
      await prisma.$executeRawUnsafe(sql)
    }
    console.log('Auth migration applied (users.username + password_reset_tokens).')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyAuthMigration()
  console.log('Next: pnpm db:seed:erp (main) or pnpm db:seed:vib-io (VIB)')
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-auth-migration.ts') ||
    process.argv[1].endsWith('apply-auth-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
