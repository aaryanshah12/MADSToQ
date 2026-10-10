-- Both processes live on one production product.

ALTER TABLE production_product_rms
  ADD COLUMN IF NOT EXISTS process text NOT NULL DEFAULT 'sfg';
ALTER TABLE production_product_rms
  DROP CONSTRAINT IF EXISTS production_product_rms_process_check;
ALTER TABLE production_product_rms
  ADD CONSTRAINT production_product_rms_process_check
  CHECK (process IN ('sfg', 'fg'));

ALTER TABLE production_process_stages
  ADD COLUMN IF NOT EXISTS process text NOT NULL DEFAULT 'sfg';
ALTER TABLE production_process_stages
  DROP CONSTRAINT IF EXISTS production_process_stages_process_check;
ALTER TABLE production_process_stages
  ADD CONSTRAINT production_process_stages_process_check
  CHECK (process IN ('sfg', 'fg'));

ALTER TABLE production_output_fields
  ADD COLUMN IF NOT EXISTS process text NOT NULL DEFAULT 'sfg';
ALTER TABLE production_output_fields
  DROP CONSTRAINT IF EXISTS production_output_fields_process_check;
ALTER TABLE production_output_fields
  ADD CONSTRAINT production_output_fields_process_check
  CHECK (process IN ('sfg', 'fg'));
