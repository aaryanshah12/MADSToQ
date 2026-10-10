/**
 * Apply inventory PO / Lot numbering tables.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-inventory-numbering-migration.ts
 */
import './load-env.js'
import { PrismaClient } from '../src/generated/client'

export async function applyInventoryNumberingMigration() {
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS inventory_numbering_config (
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  prefix text NOT NULL DEFAULT '',
  number_format text NOT NULL DEFAULT 'slash_seq_fy',
  pad_width integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (factory_id, doc_type),
  CONSTRAINT inventory_numbering_config_doc_type_check
    CHECK (doc_type IN ('po', 'lot')),
  CONSTRAINT inventory_numbering_config_format_check
    CHECK (number_format IN ('slash_seq_fy')),
  CONSTRAINT inventory_numbering_config_pad_width_check
    CHECK (pad_width >= 0 AND pad_width <= 8)
)`)

    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS inventory_doc_counters (
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  fiscal_year text NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (factory_id, doc_type, fiscal_year),
  CONSTRAINT inventory_doc_counters_doc_type_check
    CHECK (doc_type IN ('po', 'lot')),
  CONSTRAINT inventory_doc_counters_last_seq_check
    CHECK (last_seq >= 0)
)`)

    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS inventory_doc_counters_factory_id_idx
  ON inventory_doc_counters (factory_id)`)

    console.log('Inventory numbering migration applied.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyInventoryNumberingMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-inventory-numbering-migration.ts') ||
    process.argv[1].endsWith('apply-inventory-numbering-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
