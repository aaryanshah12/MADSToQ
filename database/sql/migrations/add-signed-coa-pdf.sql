-- Signed certificate PDF for a dispatch lot. Bytes stay in this table so sale lists do not load them.

CREATE TABLE IF NOT EXISTS dispatch_schedule_lot_signed_coas (
  lot_id uuid PRIMARY KEY REFERENCES dispatch_schedule_lots(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  mime_type text NOT NULL,
  size_bytes integer NOT NULL,
  file_bytes bytea NOT NULL,
  uploaded_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);
