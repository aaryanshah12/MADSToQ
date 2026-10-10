/**
 * One-shot Ananta Fine Chem setup: auth migrate + seed.
 *
 *   cd database
 *   set -a && source .env.ananta && set +a
 *   pnpm db:setup:ananta
 */
import './load-env.js'
import { applyAuthMigration } from './apply-auth-migration.js'
import { applyWarehouseMigration } from './apply-warehouse-migration.js'
import { applyLabInchargeMigration } from './apply-lab-incharge-migration.js'
import { applyInventoryNumberingMigration } from './apply-inventory-numbering-migration.js'
import { applyProductionBatchesMigration } from './apply-production-batches-migration.js'
import { seedAnanta } from '../seeds/seed-ananta.js'

async function main() {
  await applyAuthMigration()
  await applyWarehouseMigration()
  await applyLabInchargeMigration()
  await applyInventoryNumberingMigration()
  await applyProductionBatchesMigration()
  await seedAnanta()
  console.log(
    '\nAnanta Fine Chem setup complete. Next: Render env (AUTH_URL, RESEND_*) and test login.',
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
