-- Serial sort key, then expression indexes for serial-desc list pagination.
-- Safe to run as one script. The function must exist before the indexes.

CREATE OR REPLACE FUNCTION natural_sort_key(s text)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $fn$
DECLARE
  result text := '';
  m text[];
  rest text := COALESCE(s, '');
  prefix text;
  digits text;
BEGIN
  WHILE rest <> '' LOOP
    m := regexp_match(rest, '^(\D*)(\d*)');
    IF m IS NULL THEN
      EXIT;
    END IF;
    prefix := COALESCE(m[1], '');
    digits := COALESCE(m[2], '');
    IF prefix = '' AND digits = '' THEN
      EXIT;
    END IF;
    result := result || lower(prefix);
    IF digits <> '' THEN
      result := result || lpad(digits, 10, '0');
    END IF;
    rest := substring(rest FROM char_length(prefix) + char_length(digits) + 1);
  END LOOP;
  RETURN result;
END;
$fn$;

CREATE INDEX IF NOT EXISTS io_inward_factory_serial_idx
  ON io_inward (factory_id, natural_sort_key(inward_number) DESC);

CREATE INDEX IF NOT EXISTS io_outward_factory_serial_idx
  ON io_outward (factory_id, natural_sort_key(outward_number) DESC);

CREATE INDEX IF NOT EXISTS io_domestic_factory_serial_idx
  ON io_domestic (factory_id, natural_sort_key(invoice_number) DESC);

CREATE INDEX IF NOT EXISTS io_international_factory_serial_idx
  ON io_international (factory_id, natural_sort_key(invoice_number) DESC);

CREATE INDEX IF NOT EXISTS io_quotations_factory_serial_idx
  ON io_quotations (factory_id, natural_sort_key(quotation_number) DESC);

CREATE INDEX IF NOT EXISTS procurement_po_factory_serial_idx
  ON procurement_purchase_orders (factory_id, natural_sort_key(po_number) DESC);

CREATE INDEX IF NOT EXISTS procurement_receipts_factory_serial_idx
  ON procurement_receipts (factory_id, natural_sort_key(receipt_number) DESC);

CREATE INDEX IF NOT EXISTS production_batches_factory_serial_idx
  ON production_batches (factory_id, natural_sort_key(batch_no) DESC);

CREATE INDEX IF NOT EXISTS dispatch_schedules_factory_serial_idx
  ON dispatch_schedules (factory_id, natural_sort_key(sale_no) DESC);

CREATE INDEX IF NOT EXISTS employees_factory_serial_idx
  ON employees (factory_id, natural_sort_key(employee_code) DESC);

CREATE INDEX IF NOT EXISTS stock_entries_factory_serial_idx
  ON stock_entries (factory_id, natural_sort_key(invoice_number) DESC);

CREATE INDEX IF NOT EXISTS sales_documents_org_serial_idx
  ON sales_documents (org_id, natural_sort_key(doc_number) DESC);

CREATE INDEX IF NOT EXISTS pmc_references_user_serial_idx
  ON pmc_references (user_id, natural_sort_key(ref_number) DESC);
