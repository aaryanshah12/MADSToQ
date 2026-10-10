-- Company / tax details for factory (buyer on procurement POs)
ALTER TABLE factories
  ADD COLUMN IF NOT EXISTS company_address text,
  ADD COLUMN IF NOT EXISTS pan_number text,
  ADD COLUMN IF NOT EXISTS gst_number text,
  ADD COLUMN IF NOT EXISTS gst_range text,
  ADD COLUMN IF NOT EXISTS gst_division text,
  ADD COLUMN IF NOT EXISTS commissionerate text;
