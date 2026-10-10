-- Explicit byproduct flag on production output fields (separate warehouse lots / tabs).
ALTER TABLE production_output_fields
  ADD COLUMN IF NOT EXISTS is_byproduct boolean NOT NULL DEFAULT false;

-- Backfill: finishes that skipped QC were treated as byproducts.
UPDATE production_output_fields
SET is_byproduct = true
WHERE requires_qc = false
  AND is_computed = false
  AND is_byproduct = false;
