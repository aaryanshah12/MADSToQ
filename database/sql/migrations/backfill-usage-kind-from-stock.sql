-- Copy usage.stock_kind from the stock lot. Drop silent RM default.

UPDATE usage_entries u
SET stock_kind = s.stock_kind
FROM stock_entries s
WHERE s.invoice_number = u.invoice_number
  AND s.stock_kind IN ('rm', 'sfg', 'fg', 'byproduct');

ALTER TABLE usage_entries
  ALTER COLUMN stock_kind DROP DEFAULT;
