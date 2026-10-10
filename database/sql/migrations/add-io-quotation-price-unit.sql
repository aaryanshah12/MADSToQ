-- Per-line quotation price unit (INR/KG or USD/KG)
ALTER TABLE io_quotation_items
  ADD COLUMN IF NOT EXISTS price_unit text NOT NULL DEFAULT 'INR/KG';
