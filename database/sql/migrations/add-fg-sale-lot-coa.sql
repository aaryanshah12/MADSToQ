-- Per-lot COA fields for FG dispatch (Lab issues COA from existing FG QC tests).

ALTER TABLE fg_sale_lots
  ADD COLUMN IF NOT EXISTS coa_no text,
  ADD COLUMN IF NOT EXISTS coa_issued_at timestamptz(6),
  ADD COLUMN IF NOT EXISTS coa_issued_by uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fg_sale_lots_coa_issued_by_fkey'
  ) THEN
    ALTER TABLE fg_sale_lots
      ADD CONSTRAINT fg_sale_lots_coa_issued_by_fkey
      FOREIGN KEY (coa_issued_by) REFERENCES profiles(id) ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
