-- Per finished-output flag: include in FG QC send
ALTER TABLE production_output_fields
  ADD COLUMN IF NOT EXISTS requires_qc boolean NOT NULL DEFAULT true;
