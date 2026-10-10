/**
 * Apply warehouse issue flow migration.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-warehouse-migration.ts
 */
import './load-env.js'
import { PrismaClient } from '../src/generated/client'

export async function applyWarehouseMigration() {
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  ALTER TYPE "ProfileRole" ADD VALUE IF NOT EXISTS 'plant_supervisor';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;`)
    await prisma.$executeRawUnsafe(`
DO $$ BEGIN
  ALTER TYPE "ProfileRole" ADD VALUE IF NOT EXISTS 'warehouse_manager';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;`)

    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS warehouse_issue_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  material_type text NOT NULL,
  qty numeric(12, 3) NOT NULL,
  unit text NOT NULL DEFAULT 'Kg',
  needed_by_date date,
  notes text,
  stock_grade text NOT NULL DEFAULT 'approved',
  status text NOT NULL DEFAULT 'pending',
  qty_released numeric(12, 3) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  released_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_issue_requests_status_check
    CHECK (status IN ('pending', 'partial', 'released', 'cancelled')),
  CONSTRAINT warehouse_issue_requests_stock_grade_check
    CHECK (stock_grade IN ('approved', 'rejected')),
  CONSTRAINT warehouse_issue_requests_qty_check CHECK (qty > 0),
  CONSTRAINT warehouse_issue_requests_qty_released_check CHECK (qty_released >= 0)
)`)

    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS warehouse_issue_requests_factory_id_idx
  ON warehouse_issue_requests (factory_id)`)
    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS warehouse_issue_requests_status_idx
  ON warehouse_issue_requests (status)`)

    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS warehouse_issue_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES warehouse_issue_requests(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  qty numeric(12, 3) NOT NULL,
  usage_entry_id uuid REFERENCES usage_entries(id) ON DELETE SET NULL,
  released_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_issue_releases_qty_check CHECK (qty > 0)
)`)

    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS warehouse_issue_releases_request_id_idx
  ON warehouse_issue_releases (request_id)`)
    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS warehouse_issue_releases_invoice_number_idx
  ON warehouse_issue_releases (invoice_number)`)

    console.log('Warehouse issue flow migration applied.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyWarehouseMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-warehouse-migration.ts') ||
    process.argv[1].endsWith('apply-warehouse-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
