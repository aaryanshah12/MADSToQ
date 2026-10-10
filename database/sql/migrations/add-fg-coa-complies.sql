-- Description and Identification on finished-goods QC: complies or does not comply, without an instrument.

ALTER TABLE qc_log_entries
  ALTER COLUMN instrument_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS result_kind text;

CREATE UNIQUE INDEX IF NOT EXISTS qc_log_entries_result_kind_uidx
  ON qc_log_entries (subject_id, result_kind)
  WHERE result_kind IS NOT NULL;
