-- Bill to / Ship to on purchase orders
ALTER TABLE procurement_purchase_orders
  ADD COLUMN IF NOT EXISTS bill_to text,
  ADD COLUMN IF NOT EXISTS ship_to text;
