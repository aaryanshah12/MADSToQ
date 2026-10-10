-- SD, HBr, and HC quantities on finished-goods recipes, beside finished goods and by-product.

INSERT INTO production_output_fields (
  id, product_id, name, sort_order, is_computed, requires_qc, is_byproduct, process
)
SELECT
  gen_random_uuid(),
  p.product_id,
  v.name,
  p.max_order + v.n,
  false,
  false,
  true,
  'fg'
FROM (
  SELECT product_id, MAX(sort_order) AS max_order
  FROM production_output_fields
  WHERE process = 'fg'
  GROUP BY product_id
) p
CROSS JOIN (
  VALUES ('SD', 1), ('HBr', 2), ('HC', 3)
) AS v(name, n)
WHERE NOT EXISTS (
  SELECT 1
  FROM production_output_fields o
  WHERE o.product_id = p.product_id
    AND o.process = 'fg'
    AND lower(btrim(o.name)) = lower(v.name)
);

INSERT INTO production_batch_outputs (id, batch_id, output_field_id, qty)
SELECT gen_random_uuid(), b.id, o.id, 0
FROM production_batches b
JOIN production_output_fields o
  ON o.product_id = b.product_id
 AND o.process = 'fg'
 AND lower(btrim(o.name)) IN ('sd', 'hbr', 'hc')
WHERE b.kind = 'fg'
  AND NOT EXISTS (
    SELECT 1
    FROM production_batch_outputs bo
    WHERE bo.batch_id = b.id
      AND bo.output_field_id = o.id
  );
