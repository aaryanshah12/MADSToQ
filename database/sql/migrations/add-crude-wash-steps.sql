-- Per-chemical start/end inside "Washing of crude" (sulphuric acid, caustic, soda ash).

ALTER TABLE production_batch_stage_logs
  ADD COLUMN IF NOT EXISTS wash_steps jsonb;
