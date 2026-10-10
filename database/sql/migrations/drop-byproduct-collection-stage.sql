-- By-product collection was only a timed process step. Finished goods still record a by-product qty.

DELETE FROM production_batch_stage_logs
WHERE stage_id IN (
  SELECT id FROM production_process_stages
  WHERE lower(btrim(name)) = 'by-product collection'
);

DELETE FROM production_process_stages
WHERE lower(btrim(name)) = 'by-product collection';
