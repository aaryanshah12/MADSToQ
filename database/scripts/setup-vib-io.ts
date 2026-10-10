/**
 * One-shot VIB IO auth setup: migrate username/reset schema + seed user.
 *
 *   cd database && cp .env.example .env   # fill in Neon URLs + VIB_USER_*
 *   pnpm db:setup:vib-io
 */
import './load-env.js'
import { applyAuthMigration } from './apply-auth-migration.js'
import { seedVibIo } from '../seeds/seed-vib-io.js'

async function main() {
  await applyAuthMigration()
  await seedVibIo()
  console.log('\nVIB IO setup complete. Next: set Render env (AUTH_URL, RESEND_*) and test forgot-password.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
