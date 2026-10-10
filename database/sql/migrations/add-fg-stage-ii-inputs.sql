-- FG Stage-II: mixed SFG/RM inputs, filter integrity capture.

ALTER TABLE production_product_rms
  ADD COLUMN IF NOT EXISTS stock_kind text NOT NULL DEFAULT 'rm';
ALTER TABLE production_product_rms
  DROP CONSTRAINT IF EXISTS production_product_rms_stock_kind_check;
ALTER TABLE production_product_rms
  ADD CONSTRAINT production_product_rms_stock_kind_check
  CHECK (stock_kind IN ('rm', 'sfg'));

ALTER TABLE production_process_stages
  ADD COLUMN IF NOT EXISTS capture_integrity boolean NOT NULL DEFAULT false;

ALTER TABLE production_batch_stage_logs
  ADD COLUMN IF NOT EXISTS integrity_ok boolean;
