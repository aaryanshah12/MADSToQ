-- Plant supervisor + warehouse manager roles, and warehouse issue request/release tables.
-- Safe to re-run.

DO $$ BEGIN
  ALTER TYPE "ProfileRole" ADD VALUE IF NOT EXISTS 'plant_supervisor';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE "ProfileRole" ADD VALUE IF NOT EXISTS 'warehouse_manager';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS warehouse_issue_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  material_type text NOT NULL,
  qty numeric(12, 3) NOT NULL,
  unit text NOT NULL DEFAULT 'Kg',
  needed_by_date date,
  notes text,
  stock_grade text NOT NULL DEFAULT 'approved',
  status text NOT NULL DEFAULT 'pending',
  qty_released numeric(12, 3) NOT NULL DEFAULT 0,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  released_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  released_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_issue_requests_status_check
    CHECK (status IN ('pending', 'partial', 'released', 'cancelled')),
  CONSTRAINT warehouse_issue_requests_stock_grade_check
    CHECK (stock_grade IN ('approved', 'rejected')),
  CONSTRAINT warehouse_issue_requests_qty_check CHECK (qty > 0),
  CONSTRAINT warehouse_issue_requests_qty_released_check CHECK (qty_released >= 0)
);

CREATE INDEX IF NOT EXISTS warehouse_issue_requests_factory_id_idx
  ON warehouse_issue_requests (factory_id);

CREATE INDEX IF NOT EXISTS warehouse_issue_requests_status_idx
  ON warehouse_issue_requests (status);

CREATE TABLE IF NOT EXISTS warehouse_issue_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES warehouse_issue_requests(id) ON DELETE CASCADE,
  invoice_number text NOT NULL,
  qty numeric(12, 3) NOT NULL,
  usage_entry_id uuid REFERENCES usage_entries(id) ON DELETE SET NULL,
  released_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT warehouse_issue_releases_qty_check CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS warehouse_issue_releases_request_id_idx
  ON warehouse_issue_releases (request_id);

CREATE INDEX IF NOT EXISTS warehouse_issue_releases_invoice_number_idx
  ON warehouse_issue_releases (invoice_number);
