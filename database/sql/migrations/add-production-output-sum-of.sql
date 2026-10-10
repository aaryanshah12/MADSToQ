-- Computed finished outputs: sum of sibling field names (JSON string array)
ALTER TABLE production_output_fields
  ADD COLUMN IF NOT EXISTS sum_of jsonb;
