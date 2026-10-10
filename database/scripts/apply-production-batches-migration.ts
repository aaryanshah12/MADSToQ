/**
 * Apply reusable production batch tables.
 *   cd database && set -a && source .env.ananta && set +a && npx tsx scripts/apply-production-batches-migration.ts
 */
import './load-env.js'
import { PrismaClient } from '../src/generated/client'

export async function applyProductionBatchesMigration() {
  const prisma = new PrismaClient()
  try {
    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS production_products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_products_factory_code_unique UNIQUE (factory_id, code)
)`)

    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS production_products_factory_id_idx
  ON production_products (factory_id)`)

    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS production_product_rms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES production_products(id) ON DELETE CASCADE,
  material_name text NOT NULL,
  unit text NOT NULL DEFAULT 'Kg',
  sort_order integer NOT NULL DEFAULT 0,
  allow_multi_lot boolean NOT NULL DEFAULT false,
  lot_required boolean NOT NULL DEFAULT true,
  max_lots integer NOT NULL DEFAULT 2,
  CONSTRAINT production_product_rms_max_lots_check CHECK (max_lots >= 1 AND max_lots <= 10)
)`)

    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS production_product_rms_product_id_idx
  ON production_product_rms (product_id)`)

    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS production_process_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES production_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  capture_start_date boolean NOT NULL DEFAULT true,
  capture_end_date boolean NOT NULL DEFAULT true,
  capture_start_time boolean NOT NULL DEFAULT true,
  capture_end_time boolean NOT NULL DEFAULT true,
  capture_start_temp boolean NOT NULL DEFAULT true,
  capture_end_temp boolean NOT NULL DEFAULT true
)`)

    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS production_process_stages_product_id_idx
  ON production_process_stages (product_id)`)

    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS production_output_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES production_products(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_computed boolean NOT NULL DEFAULT false
)`)

    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS production_output_fields_product_id_idx
  ON production_output_fields (product_id)`)

    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS production_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES production_products(id) ON DELETE RESTRICT,
  batch_no text NOT NULL,
  vessel text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT production_batches_status_check
    CHECK (status IN ('draft', 'in_progress', 'completed')),
  CONSTRAINT production_batches_factory_batch_no_unique UNIQUE (factory_id, batch_no)
)`)

    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS production_batches_factory_id_idx
  ON production_batches (factory_id)`)
    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS production_batches_product_id_idx
  ON production_batches (product_id)`)
    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS production_batches_status_idx
  ON production_batches (status)`)

    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS production_batch_rm_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  rm_def_id uuid NOT NULL REFERENCES production_product_rms(id) ON DELETE RESTRICT,
  qty numeric(12, 3) NOT NULL DEFAULT 0,
  lot_invoice text,
  lot_slot integer,
  notes text,
  usage_entry_id uuid REFERENCES usage_entries(id) ON DELETE SET NULL,
  CONSTRAINT production_batch_rm_lines_lot_slot_check
    CHECK (lot_slot IS NULL OR (lot_slot >= 1 AND lot_slot <= 10))
)`)

    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS production_batch_rm_lines_batch_id_idx
  ON production_batch_rm_lines (batch_id)`)

    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS production_batch_stage_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  stage_id uuid NOT NULL REFERENCES production_process_stages(id) ON DELETE RESTRICT,
  start_date date,
  end_date date,
  start_time text,
  end_time text,
  start_temp numeric(10, 2),
  end_temp numeric(10, 2),
  CONSTRAINT production_batch_stage_logs_batch_stage_unique UNIQUE (batch_id, stage_id)
)`)

    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS production_batch_stage_logs_batch_id_idx
  ON production_batch_stage_logs (batch_id)`)

    await prisma.$executeRawUnsafe(`
CREATE TABLE IF NOT EXISTS production_batch_outputs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id uuid NOT NULL REFERENCES production_batches(id) ON DELETE CASCADE,
  output_field_id uuid NOT NULL REFERENCES production_output_fields(id) ON DELETE RESTRICT,
  qty numeric(12, 3) NOT NULL DEFAULT 0,
  CONSTRAINT production_batch_outputs_batch_field_unique UNIQUE (batch_id, output_field_id)
)`)

    await prisma.$executeRawUnsafe(`
CREATE INDEX IF NOT EXISTS production_batch_outputs_batch_id_idx
  ON production_batch_outputs (batch_id)`)

    console.log('Production batches migration applied.')
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  await applyProductionBatchesMigration()
}

const isMain =
  typeof process.argv[1] === 'string' &&
  (process.argv[1].endsWith('apply-production-batches-migration.ts') ||
    process.argv[1].endsWith('apply-production-batches-migration.js'))

if (isMain) {
  main().catch((e) => {
    console.error(e)
    process.exit(1)
  })
}
