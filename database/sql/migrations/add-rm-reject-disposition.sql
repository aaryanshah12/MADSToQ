-- After RM QC reject: accept at discounted price (debit note) or return to vendor.
-- Safe to re-run.

ALTER TABLE procurement_receipts
  ADD COLUMN IF NOT EXISTS accepted_price_per_unit numeric(14, 2),
  ADD COLUMN IF NOT EXISTS debit_note_ref text,
  ADD COLUMN IF NOT EXISTS return_date date,
  ADD COLUMN IF NOT EXISTS return_vehicle_number text,
  ADD COLUMN IF NOT EXISTS return_notes text,
  ADD COLUMN IF NOT EXISTS returned_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS returned_at timestamptz;

ALTER TABLE procurement_receipts
  DROP CONSTRAINT IF EXISTS procurement_receipts_status_check;

ALTER TABLE procurement_receipts
  ADD CONSTRAINT procurement_receipts_status_check
  CHECK (status IN (
    'pending_qc',
    'awaiting_admin',
    'needs_info',
    'approved',
    'rejected',
    'returned_to_vendor'
  ));
