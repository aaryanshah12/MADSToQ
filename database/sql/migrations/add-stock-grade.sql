-- Distinguish approved vs rejected warehouse lots, and issue requests by grade.
-- Rejected SFG is releasable to plant but not used as production RM.
-- Safe to re-run.

ALTER TABLE stock_entries
  ADD COLUMN IF NOT EXISTS stock_grade TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE stock_entries
  DROP CONSTRAINT IF EXISTS stock_entries_stock_grade_check;

ALTER TABLE stock_entries
  ADD CONSTRAINT stock_entries_stock_grade_check
  CHECK (stock_grade IN ('approved', 'rejected'));

CREATE INDEX IF NOT EXISTS stock_entries_factory_id_stock_grade_idx
  ON stock_entries (factory_id, stock_grade);

ALTER TABLE warehouse_issue_requests
  ADD COLUMN IF NOT EXISTS stock_grade TEXT NOT NULL DEFAULT 'approved';

ALTER TABLE warehouse_issue_requests
  DROP CONSTRAINT IF EXISTS warehouse_issue_requests_stock_grade_check;

ALTER TABLE warehouse_issue_requests
  ADD CONSTRAINT warehouse_issue_requests_stock_grade_check
  CHECK (stock_grade IN ('approved', 'rejected'));
