-- Composite / lookup indexes for inventory list and QC queue filters.

CREATE INDEX IF NOT EXISTS production_batch_rm_lines_lot_invoice_idx
  ON production_batch_rm_lines (lot_invoice);

CREATE INDEX IF NOT EXISTS production_batches_factory_id_qc_status_idx
  ON production_batches (factory_id, qc_status);

CREATE INDEX IF NOT EXISTS production_batches_factory_id_status_idx
  ON production_batches (factory_id, status);

CREATE INDEX IF NOT EXISTS warehouse_issue_requests_factory_id_status_idx
  ON warehouse_issue_requests (factory_id, status);

CREATE INDEX IF NOT EXISTS procurement_receipts_factory_id_status_idx
  ON procurement_receipts (factory_id, status);

CREATE INDEX IF NOT EXISTS fg_sales_factory_id_status_idx
  ON fg_sales (factory_id, status);
