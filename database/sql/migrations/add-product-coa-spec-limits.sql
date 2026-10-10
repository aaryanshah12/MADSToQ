-- Specification limits for the remaining certificate tests, beside description and identification.

ALTER TABLE production_products
  ADD COLUMN IF NOT EXISTS coa_specific_gravity_spec text,
  ADD COLUMN IF NOT EXISTS coa_water_spec text,
  ADD COLUMN IF NOT EXISTS coa_boiling_point_spec text,
  ADD COLUMN IF NOT EXISTS coa_gc_purity_spec text;
