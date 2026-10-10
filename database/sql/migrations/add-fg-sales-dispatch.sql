-- FG sales dispatch: customers, sale instructions, picked lots, sale/coa numbering.

ALTER TABLE inventory_numbering_config
  DROP CONSTRAINT IF EXISTS inventory_numbering_config_doc_type_check;
ALTER TABLE inventory_numbering_config
  ADD CONSTRAINT inventory_numbering_config_doc_type_check
  CHECK (doc_type IN ('po', 'lot', 'batch', 'sale', 'coa'));

ALTER TABLE inventory_doc_counters
  DROP CONSTRAINT IF EXISTS inventory_doc_counters_doc_type_check;
ALTER TABLE inventory_doc_counters
  ADD CONSTRAINT inventory_doc_counters_doc_type_check
  CHECK (doc_type IN ('po', 'lot', 'batch', 'sale', 'coa'));

INSERT INTO inventory_numbering_config (factory_id, doc_type, prefix, number_format, pad_width, updated_at)
SELECT id, 'sale', 'AFC/SL', 'slash_seq_fy', 0, now()
FROM factories
ON CONFLICT (factory_id, doc_type) DO NOTHING;

INSERT INTO inventory_numbering_config (factory_id, doc_type, prefix, number_format, pad_width, updated_at)
SELECT id, 'coa', 'AFC/COA', 'slash_seq_fy', 0, now()
FROM factories
ON CONFLICT (factory_id, doc_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS customers (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id       uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  name             text NOT NULL,
  company_address  text,
  gst_number       text,
  email            text,
  contact_title    text,
  contact_name     text,
  contact_phone    text,
  is_active        boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS customers_factory_id_idx ON customers(factory_id);

CREATE TABLE IF NOT EXISTS fg_sales (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id          uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  sale_no             text NOT NULL,
  customer_id         uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  product_id          uuid REFERENCES production_products(id) ON DELETE SET NULL,
  product_code        text NOT NULL,
  product_name        text NOT NULL,
  qty                 numeric(12, 3) NOT NULL,
  unit                text NOT NULL DEFAULT 'Kg',
  rate                numeric(14, 4) NOT NULL,
  purity_spec         numeric(8, 4),
  client_po_no        text,
  preferred_batch_nos jsonb NOT NULL DEFAULT '[]'::jsonb,
  status              text NOT NULL DEFAULT 'instructed',
  tally_invoice_no    text,
  vehicle_no          text,
  coa_no              text,
  coa_issued_at       timestamptz,
  coa_issued_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_by          uuid REFERENCES profiles(id) ON DELETE SET NULL,
  invoiced_by         uuid REFERENCES profiles(id) ON DELETE SET NULL,
  invoiced_at         timestamptz,
  picked_by           uuid REFERENCES profiles(id) ON DELETE SET NULL,
  picked_at           timestamptz,
  dispatched_by       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  dispatched_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  UNIQUE (factory_id, sale_no)
);
CREATE INDEX IF NOT EXISTS fg_sales_factory_id_idx ON fg_sales(factory_id);
CREATE INDEX IF NOT EXISTS fg_sales_status_idx ON fg_sales(status);

CREATE TABLE IF NOT EXISTS fg_sale_lots (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id         uuid NOT NULL REFERENCES fg_sales(id) ON DELETE CASCADE,
  invoice_number  text NOT NULL,
  qty             numeric(12, 3) NOT NULL,
  usage_entry_id  uuid REFERENCES usage_entries(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS fg_sale_lots_sale_id_idx ON fg_sale_lots(sale_id);
CREATE INDEX IF NOT EXISTS fg_sale_lots_invoice_number_idx ON fg_sale_lots(invoice_number);
