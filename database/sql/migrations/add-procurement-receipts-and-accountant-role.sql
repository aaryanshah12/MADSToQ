-- Accountant role + procurement receipts (receive vs PO, pending QC).
-- Safe to re-run.

DO $$ BEGIN
  ALTER TYPE "ProfileRole" ADD VALUE IF NOT EXISTS 'accountant';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS procurement_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  po_id uuid NOT NULL REFERENCES procurement_purchase_orders(id) ON DELETE CASCADE,
  receipt_number text NOT NULL,
  material_type text NOT NULL,
  unit text NOT NULL DEFAULT 'Kg',
  ordered_qty numeric(12, 3) NOT NULL,
  po_price_per_unit numeric(14, 2),
  received_qty numeric(12, 3) NOT NULL,
  received_price_per_unit numeric(14, 2) NOT NULL,
  vendor_name text NOT NULL,
  supplier_invoice_no text,
  vehicle_number text,
  received_date date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  status text NOT NULL DEFAULT 'pending_qc',
  qc_notes text,
  qc_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  qc_at timestamptz,
  stock_entry_id uuid REFERENCES stock_entries(id) ON DELETE SET NULL,
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procurement_receipts_factory_number_unique UNIQUE (factory_id, receipt_number),
  CONSTRAINT procurement_receipts_status_check
    CHECK (status IN ('pending_qc', 'awaiting_admin', 'needs_info', 'approved', 'rejected'))
);

CREATE INDEX IF NOT EXISTS procurement_receipts_factory_id_idx
  ON procurement_receipts (factory_id);

CREATE INDEX IF NOT EXISTS procurement_receipts_po_id_idx
  ON procurement_receipts (po_id);

CREATE INDEX IF NOT EXISTS procurement_receipts_status_idx
  ON procurement_receipts (status);
