-- Shared QC lab instruments + log entries + admin parameter requests (RM/SFG/FG).
CREATE TABLE IF NOT EXISTS qc_instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (factory_id, code)
);

CREATE INDEX IF NOT EXISTS qc_instruments_factory_type_idx ON qc_instruments (factory_id, type);

CREATE TABLE IF NOT EXISTS qc_log_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  instrument_id uuid NOT NULL REFERENCES qc_instruments(id) ON DELETE RESTRICT,
  stage text NOT NULL DEFAULT 'rm',
  subject_id uuid NOT NULL,
  entry_date date NOT NULL,
  sample_name text NOT NULL,
  remarks text,
  payload jsonb NOT NULL DEFAULT '{}',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qc_log_entries_subject_idx ON qc_log_entries (factory_id, stage, subject_id);
CREATE INDEX IF NOT EXISTS qc_log_entries_instrument_idx ON qc_log_entries (instrument_id);

CREATE TABLE IF NOT EXISTS qc_parameter_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  stage text NOT NULL DEFAULT 'rm',
  subject_id uuid NOT NULL,
  requested_types jsonb NOT NULL DEFAULT '[]',
  note text,
  status text NOT NULL DEFAULT 'open',
  requested_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

CREATE INDEX IF NOT EXISTS qc_parameter_requests_subject_idx ON qc_parameter_requests (factory_id, stage, subject_id);
CREATE INDEX IF NOT EXISTS qc_parameter_requests_status_idx ON qc_parameter_requests (status);
