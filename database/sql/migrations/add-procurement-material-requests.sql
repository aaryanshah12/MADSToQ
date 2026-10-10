-- Chemist material requests + owner PO enrichment (Ananta procurement flow)
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS procurement_material_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  material_type text NOT NULL,
  qty numeric(12, 3) NOT NULL,
  unit text NOT NULL DEFAULT 'Kg',
  needed_by_date date NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'pending',
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procurement_material_requests_status_check
    CHECK (status IN ('pending', 'converted', 'cancelled')),
  CONSTRAINT procurement_material_requests_qty_check CHECK (qty > 0)
);

CREATE INDEX IF NOT EXISTS procurement_material_requests_factory_id_idx
  ON procurement_material_requests (factory_id);

CREATE INDEX IF NOT EXISTS procurement_material_requests_status_idx
  ON procurement_material_requests (factory_id, status);

ALTER TABLE procurement_purchase_orders
  ADD COLUMN IF NOT EXISTS request_id uuid REFERENCES procurement_material_requests(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS delivery_date date,
  ADD COLUMN IF NOT EXISTS payment_terms text,
  ADD COLUMN IF NOT EXISTS quality_ref text,
  ADD COLUMN IF NOT EXISTS coa_required boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS special_instructions text,
  ADD COLUMN IF NOT EXISTS shared_at timestamptz;

CREATE INDEX IF NOT EXISTS procurement_purchase_orders_request_id_idx
  ON procurement_purchase_orders (request_id);
