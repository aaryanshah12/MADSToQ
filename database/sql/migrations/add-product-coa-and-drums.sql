-- Product COA identity (CAS + Description / Identification specifications)
-- and drum count recorded with the accountant invoice.

ALTER TABLE production_products
  ADD COLUMN IF NOT EXISTS cas_number text,
  ADD COLUMN IF NOT EXISTS coa_description_spec text,
  ADD COLUMN IF NOT EXISTS coa_identification_spec text;

ALTER TABLE dispatch_schedules
  ADD COLUMN IF NOT EXISTS drum_count integer;
