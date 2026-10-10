-- Procurement purchase orders (Ananta manufacturing inbound step 1)
-- Safe to re-run.

CREATE TABLE IF NOT EXISTS procurement_purchase_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  po_number text NOT NULL,
  supplier_id uuid REFERENCES suppliers(id) ON DELETE SET NULL,
  supplier_name text NOT NULL,
  material_type text NOT NULL,
  qty numeric(12, 3) NOT NULL,
  unit text NOT NULL DEFAULT 'Kg',
  status text NOT NULL DEFAULT 'draft',
  po_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procurement_purchase_orders_factory_po_unique UNIQUE (factory_id, po_number),
  CONSTRAINT procurement_purchase_orders_status_check
    CHECK (status IN ('draft', 'issued', 'partial', 'received', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS procurement_purchase_orders_factory_id_idx
  ON procurement_purchase_orders (factory_id);

CREATE INDEX IF NOT EXISTS procurement_purchase_orders_po_date_idx
  ON procurement_purchase_orders (po_date DESC);
