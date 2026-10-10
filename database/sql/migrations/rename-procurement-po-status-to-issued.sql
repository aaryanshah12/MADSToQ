-- PO status: issued when generated (no delivery/share yet). Replaces ordered/shared.
-- Safe to re-run.

ALTER TABLE procurement_purchase_orders
  DROP CONSTRAINT IF EXISTS procurement_purchase_orders_status_check;

UPDATE procurement_purchase_orders
SET status = 'issued'
WHERE status IN ('ordered', 'shared');

ALTER TABLE procurement_purchase_orders
  ALTER COLUMN status SET DEFAULT 'draft';

ALTER TABLE procurement_purchase_orders
  ADD CONSTRAINT procurement_purchase_orders_status_check
  CHECK (status IN ('draft', 'issued', 'partial', 'received', 'cancelled'));
