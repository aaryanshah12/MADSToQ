-- Conclusion and storage condition printed on the product certificate of analysis.

ALTER TABLE production_products
  ADD COLUMN IF NOT EXISTS coa_conclusion text,
  ADD COLUMN IF NOT EXISTS coa_storage_condition text;
