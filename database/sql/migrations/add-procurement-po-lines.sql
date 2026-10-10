-- Multiple item lines on a procurement PO (JSON array of material/qty/rate/hsn).
ALTER TABLE procurement_purchase_orders
  ADD COLUMN IF NOT EXISTS lines jsonb;
