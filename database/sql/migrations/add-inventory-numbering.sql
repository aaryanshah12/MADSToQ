-- Inventory PO / Lot (GRN) numbering master
CREATE TABLE IF NOT EXISTS inventory_numbering_config (
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  prefix text NOT NULL DEFAULT '',
  number_format text NOT NULL DEFAULT 'slash_seq_fy',
  pad_width integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (factory_id, doc_type),
  CONSTRAINT inventory_numbering_config_doc_type_check
    CHECK (doc_type IN ('po', 'lot')),
  CONSTRAINT inventory_numbering_config_format_check
    CHECK (number_format IN ('slash_seq_fy')),
  CONSTRAINT inventory_numbering_config_pad_width_check
    CHECK (pad_width >= 0 AND pad_width <= 8)
);

CREATE TABLE IF NOT EXISTS inventory_doc_counters (
  factory_id uuid NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  fiscal_year text NOT NULL,
  last_seq integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (factory_id, doc_type, fiscal_year),
  CONSTRAINT inventory_doc_counters_doc_type_check
    CHECK (doc_type IN ('po', 'lot')),
  CONSTRAINT inventory_doc_counters_last_seq_check
    CHECK (last_seq >= 0)
);

CREATE INDEX IF NOT EXISTS inventory_doc_counters_factory_id_idx
  ON inventory_doc_counters (factory_id);
