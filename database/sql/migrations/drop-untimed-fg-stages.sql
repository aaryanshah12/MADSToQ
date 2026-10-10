-- Collect in vessel and Finish received were only timed process steps.
-- Finished-goods quantity stays on the batch output.

DELETE FROM production_batch_stage_logs
WHERE stage_id IN (
  SELECT id FROM production_process_stages
  WHERE lower(btrim(name)) IN ('collect in vessel', 'finish received')
);

DELETE FROM production_process_stages
WHERE lower(btrim(name)) IN ('collect in vessel', 'finish received');
