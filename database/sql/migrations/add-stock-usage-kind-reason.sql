-- First-class byproduct stock_kind, plus usage kind and reason.

ALTER TABLE usage_entries
  ADD COLUMN IF NOT EXISTS stock_kind text NOT NULL DEFAULT 'rm';

ALTER TABLE usage_entries
  ADD COLUMN IF NOT EXISTS usage_reason text NOT NULL DEFAULT 'plant_consume';

CREATE INDEX IF NOT EXISTS usage_entries_factory_kind_idx
  ON usage_entries (factory_id, stock_kind);

ALTER TABLE stock_entries
  DROP CONSTRAINT IF EXISTS stock_entries_stock_kind_check;

ALTER TABLE stock_entries
  ADD CONSTRAINT stock_entries_stock_kind_check
  CHECK (stock_kind IN ('rm', 'sfg', 'fg', 'byproduct'));

UPDATE stock_entries
SET stock_kind = 'byproduct'
WHERE invoice_number LIKE '%/BP/%'
  AND stock_kind IS DISTINCT FROM 'byproduct';

UPDATE usage_entries u
SET stock_kind = CASE
  WHEN s.invoice_number LIKE '%/BP/%' THEN 'byproduct'
  WHEN s.stock_kind IN ('rm', 'sfg', 'fg', 'byproduct') THEN s.stock_kind
  ELSE u.stock_kind
END
FROM stock_entries s
WHERE s.invoice_number = u.invoice_number;

UPDATE usage_entries
SET usage_reason = 'warehouse_release'
WHERE process_id LIKE 'WH-ISSUE:%';

UPDATE usage_entries
SET usage_reason = 'production_input'
WHERE process_id LIKE 'PROD:%';

UPDATE usage_entries
SET usage_reason = 'byproduct_dispatch'
WHERE process_id LIKE 'DISPATCH:%'
  AND (stock_kind = 'byproduct' OR COALESCE(batch_notes, '') ILIKE '%byproduct%');

UPDATE usage_entries
SET usage_reason = 'fg_dispatch'
WHERE process_id LIKE 'DISPATCH:%'
  AND stock_kind IS DISTINCT FROM 'byproduct'
  AND COALESCE(batch_notes, '') NOT ILIKE '%byproduct%';
