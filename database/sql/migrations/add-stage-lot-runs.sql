-- Stage lot runs: repeat a process stage per multi-lot RM (e.g. Bromine addition Lot 2)

ALTER TABLE production_process_stages
  ADD COLUMN IF NOT EXISTS lot_rm_def_id uuid REFERENCES production_product_rms(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS production_process_stages_lot_rm_def_id_idx
  ON production_process_stages (lot_rm_def_id);

ALTER TABLE production_batch_stage_logs
  ADD COLUMN IF NOT EXISTS lot_slot integer NOT NULL DEFAULT 1;

ALTER TABLE production_batch_stage_logs
  DROP CONSTRAINT IF EXISTS production_batch_stage_logs_batch_stage_unique;

ALTER TABLE production_batch_stage_logs
  DROP CONSTRAINT IF EXISTS production_batch_stage_logs_batch_id_stage_id_lot_slot_key;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'production_batch_stage_logs_batch_stage_lot_unique'
  ) THEN
    ALTER TABLE production_batch_stage_logs
      ADD CONSTRAINT production_batch_stage_logs_batch_stage_lot_unique
      UNIQUE (batch_id, stage_id, lot_slot);
  END IF;
END $$;

ALTER TABLE production_batch_stage_logs
  DROP CONSTRAINT IF EXISTS production_batch_stage_logs_lot_slot_check;

ALTER TABLE production_batch_stage_logs
  ADD CONSTRAINT production_batch_stage_logs_lot_slot_check
  CHECK (lot_slot >= 1 AND lot_slot <= 10);

-- Auto-link stages whose name contains a multi-lot RM material (e.g. "Bromine addition" → Bromine)
UPDATE production_process_stages s
SET lot_rm_def_id = r.id
FROM production_product_rms r
WHERE s.lot_rm_def_id IS NULL
  AND r.product_id = s.product_id
  AND r.allow_multi_lot = true
  AND position(lower(r.material_name) in lower(s.name)) > 0;
