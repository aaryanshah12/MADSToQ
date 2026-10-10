-- Production batch numbering: {seq}/{prefix}/{FY} e.g. 1/AFC/26-27
-- Plus mfg date + purity stored on the batch for warehouse FG lots.

ALTER TABLE inventory_numbering_config
  DROP CONSTRAINT IF EXISTS inventory_numbering_config_doc_type_check;
ALTER TABLE inventory_numbering_config
  ADD CONSTRAINT inventory_numbering_config_doc_type_check
  CHECK (doc_type IN ('po', 'lot', 'batch'));

ALTER TABLE inventory_numbering_config
  DROP CONSTRAINT IF EXISTS inventory_numbering_config_format_check;
ALTER TABLE inventory_numbering_config
  ADD CONSTRAINT inventory_numbering_config_format_check
  CHECK (number_format IN ('slash_seq_fy', 'seq_slash_prefix_fy'));

ALTER TABLE inventory_doc_counters
  DROP CONSTRAINT IF EXISTS inventory_doc_counters_doc_type_check;
ALTER TABLE inventory_doc_counters
  ADD CONSTRAINT inventory_doc_counters_doc_type_check
  CHECK (doc_type IN ('po', 'lot', 'batch'));

ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS mfg_date date;
ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS purity numeric(8, 4);

INSERT INTO inventory_numbering_config (factory_id, doc_type, prefix, number_format, pad_width, updated_at)
SELECT id, 'batch', 'AFC', 'seq_slash_prefix_fy', 0, now()
FROM factories
ON CONFLICT (factory_id, doc_type) DO NOTHING;
