-- Expand procurement receipt statuses for chemist → admin QC workflow.
ALTER TABLE procurement_receipts
  DROP CONSTRAINT IF EXISTS procurement_receipts_status_check;

ALTER TABLE procurement_receipts
  ADD CONSTRAINT procurement_receipts_status_check
  CHECK (status IN ('pending_qc', 'awaiting_admin', 'needs_info', 'approved', 'rejected'));
