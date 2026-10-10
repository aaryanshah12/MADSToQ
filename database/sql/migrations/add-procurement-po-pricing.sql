-- Price, HSN, line remarks, and share recipients on procurement POs
ALTER TABLE procurement_purchase_orders
  ADD COLUMN IF NOT EXISTS price_per_unit numeric(14, 2),
  ADD COLUMN IF NOT EXISTS hsn_code text,
  ADD COLUMN IF NOT EXISTS line_remarks text,
  ADD COLUMN IF NOT EXISTS shared_with text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS vendor_email text,
  ADD COLUMN IF NOT EXISTS cgst_rate numeric(5, 2) DEFAULT 9,
  ADD COLUMN IF NOT EXISTS sgst_rate numeric(5, 2) DEFAULT 9;
