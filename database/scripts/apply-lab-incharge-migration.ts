/**
 * Apply lab_incharge role + migrate plant_supervisor → chemist.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-lab-incharge-migration.ts
 */
import './load-env.js'
import { PrismaClient } from '../src/generated/client'

export async function applyLabInchargeMigration() {
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  ALTER TYPE "ProfileRole" ADD VALUE IF NOT EXISTS 'lab_incharge';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;`)

    // Enum value must commit before UPDATE that uses it in some PG setups;
    // UPDATE plant_supervisor → chemist does not need lab_incharge to exist first.
    await prisma.$executeRawUnsafe(`
UPDATE profiles
SET role = 'chemist',
    updated_at = now()
WHERE role::text = 'plant_supervisor'`)

    console.log('Lab incharge migration applied (enum + plant_supervisor→chemist).')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyLabInchargeMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-lab-incharge-migration.ts') ||
    process.argv[1].endsWith('apply-lab-incharge-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
