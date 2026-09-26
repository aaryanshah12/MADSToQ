-- One-time fix: pmc_batches.unit_price should be per product unit (total ÷ batch_size),
-- not total batch cost. Run if older batches show ₹15,500 instead of ₹310 for size 50.

UPDATE public.pmc_batches b
SET unit_price = sub.per_unit
FROM (
  SELECT
    bl.batch_id AS id,
    COALESCE(SUM(bl.qty * bl.unit_price), 0) AS per_unit
  FROM public.pmc_batch_lines bl
  GROUP BY bl.batch_id
) sub
WHERE b.id = sub.id
  AND b.batch_size > 0
  AND EXISTS (SELECT 1 FROM public.pmc_batch_lines WHERE batch_id = b.id);

-- Verify: BATCH-002 with total ~15500 and size 50 should show unit_price ~310
-- SELECT batch_code, batch_size, unit_price,
--        unit_price * batch_size AS implied_total
-- FROM pmc_batches ORDER BY created_at DESC;
