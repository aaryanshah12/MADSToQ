/**
 * Merge RM master, create FG production products, add discount FG customer.
 * Does not reset users or passwords.
 *
 *   cd database && set -a && source .env.ananta && set +a && pnpm db:seed:ananta-sfg-fg
 */
import '../scripts/load-env.js'
import { applyAnantaProductionMasters } from './seed-ananta.ts'

async function main() {
  await applyAnantaProductionMasters()
  console.log('Ananta production masters (RM + FG products + discount customer) applied.')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
