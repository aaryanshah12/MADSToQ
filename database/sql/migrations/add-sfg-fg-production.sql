-- SFG vs FG production: kinds, SFG counters, warehouse stock_kind, discounted FG sales.

ALTER TABLE inventory_doc_counters
  DROP CONSTRAINT IF EXISTS inventory_doc_counters_doc_type_check;
ALTER TABLE inventory_doc_counters
  ADD CONSTRAINT inventory_doc_counters_doc_type_check
  CHECK (doc_type IN ('po', 'lot', 'batch', 'sale', 'coa', 'sfg'));

ALTER TABLE production_products
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'sfg';
ALTER TABLE production_products
  DROP CONSTRAINT IF EXISTS production_products_kind_check;
ALTER TABLE production_products
  ADD CONSTRAINT production_products_kind_check
  CHECK (kind IN ('sfg', 'fg'));

ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'sfg';
ALTER TABLE production_batches
  DROP CONSTRAINT IF EXISTS production_batches_kind_check;
ALTER TABLE production_batches
  ADD CONSTRAINT production_batches_kind_check
  CHECK (kind IN ('sfg', 'fg'));

ALTER TABLE stock_entries
  ADD COLUMN IF NOT EXISTS stock_kind text NOT NULL DEFAULT 'rm';
ALTER TABLE stock_entries
  DROP CONSTRAINT IF EXISTS stock_entries_stock_kind_check;
ALTER TABLE stock_entries
  ADD CONSTRAINT stock_entries_stock_kind_check
  CHECK (stock_kind IN ('rm', 'sfg', 'fg'));

UPDATE stock_entries
SET stock_kind = 'sfg'
WHERE stock_kind = 'rm'
  AND (supplier_name ILIKE 'production%' OR notes ILIKE '%production batch%');

ALTER TABLE warehouse_issue_requests
  ADD COLUMN IF NOT EXISTS stock_kind text NOT NULL DEFAULT 'rm';
ALTER TABLE warehouse_issue_requests
  DROP CONSTRAINT IF EXISTS warehouse_issue_requests_stock_kind_check;
ALTER TABLE warehouse_issue_requests
  ADD CONSTRAINT warehouse_issue_requests_stock_kind_check
  CHECK (stock_kind IN ('rm', 'sfg', 'fg'));

UPDATE warehouse_issue_requests
SET stock_kind = 'sfg'
WHERE stock_grade = 'rejected'
  AND stock_kind = 'rm';

ALTER TABLE fg_sales
  ADD COLUMN IF NOT EXISTS is_discounted boolean NOT NULL DEFAULT false;
