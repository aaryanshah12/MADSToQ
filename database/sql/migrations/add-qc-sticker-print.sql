-- QC approved stickers: first print marks approved_printed.

ALTER TABLE procurement_receipts
  ADD COLUMN IF NOT EXISTS sticker_printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sticker_printed_by uuid,
  ADD COLUMN IF NOT EXISTS sticker_data jsonb;

ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS sticker_printed_at timestamptz,
  ADD COLUMN IF NOT EXISTS sticker_printed_by uuid,
  ADD COLUMN IF NOT EXISTS sticker_data jsonb;

ALTER TABLE procurement_receipts
  DROP CONSTRAINT IF EXISTS procurement_receipts_status_check;

ALTER TABLE procurement_receipts
  ADD CONSTRAINT procurement_receipts_status_check
  CHECK (status IN (
    'pending_qc',
    'awaiting_admin',
    'needs_info',
    'approved',
    'approved_printed',
    'rejected',
    'returned_to_vendor'
  ));

ALTER TABLE production_batches
  DROP CONSTRAINT IF EXISTS production_batches_qc_status_check;

ALTER TABLE production_batches
  ADD CONSTRAINT production_batches_qc_status_check
  CHECK (qc_status IN (
    'none',
    'pending_qc',
    'awaiting_admin',
    'needs_info',
    'approved',
    'approved_printed',
    'rejected'
  ));
