-- Finished-goods QC status on production batches (chemist send → lab queue)
ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS qc_status text NOT NULL DEFAULT 'none';

ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS qc_sent_at timestamptz;

ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS qc_sent_by uuid;

ALTER TABLE production_batches
  ADD COLUMN IF NOT EXISTS qc_snapshot jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'production_batches_qc_status_check'
  ) THEN
    ALTER TABLE production_batches
      ADD CONSTRAINT production_batches_qc_status_check
      CHECK (qc_status IN (
        'none',
        'pending_qc',
        'awaiting_admin',
        'needs_info',
        'approved',
        'rejected'
      ));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS production_batches_qc_status_idx
  ON production_batches (qc_status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'production_batches_qc_sent_by_fkey'
  ) THEN
    ALTER TABLE production_batches
      ADD CONSTRAINT production_batches_qc_sent_by_fkey
      FOREIGN KEY (qc_sent_by) REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;
