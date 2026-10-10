-- schedule_kind: fg (default) | byproduct

ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS schedule_kind text NOT NULL DEFAULT 'fg';

CREATE INDEX IF NOT EXISTS dispatch_schedules_factory_kind_status_idx
  ON dispatch_schedules (factory_id, schedule_kind, status);
