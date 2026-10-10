-- Optional per-instrument log-book header (title, form code, annexure).
ALTER TABLE qc_instruments
  ADD COLUMN IF NOT EXISTS doc_meta jsonb;
