-- Schema-only migration (keeps existing row data).
-- For wipe + migrate in one script, use: field-encryption-full-migration.sql

BEGIN;

DROP VIEW IF EXISTS factory_summary CASCADE;

DO $drop_gen$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_entries'
      AND column_name = 'total_value'
  ) THEN
    ALTER TABLE stock_entries DROP COLUMN total_value;
  END IF;
END $drop_gen$;

CREATE OR REPLACE FUNCTION pg_temp.drop_checks_on_column(p_table text, p_column text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  r record;
BEGIN
  IF to_regclass(format('public.%I', p_table)) IS NULL THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    JOIN unnest(c.conkey) AS colnum(attnum) ON true
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = colnum.attnum
    WHERE n.nspname = 'public'
      AND t.relname = p_table
      AND a.attname = p_column
      AND c.contype = 'c'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', p_table, r.conname);
    RAISE NOTICE 'Dropped CHECK % on %.%', r.conname, p_table, p_column;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION pg_temp.migrate_money_column(p_table text, p_column text)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  col_type text;
BEGIN
  IF to_regclass(format('public.%I', p_table)) IS NULL THEN
    RETURN;
  END IF;

  SELECT c.data_type INTO col_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table
    AND c.column_name = p_column;

  IF col_type IS NULL OR col_type IN ('text', 'character varying') THEN
    RETURN;
  END IF;

  PERFORM pg_temp.drop_checks_on_column(p_table, p_column);

  EXECUTE format(
    'ALTER TABLE %I ALTER COLUMN %I TYPE TEXT USING %I::text',
    p_table, p_column, p_column
  );
END;
$$;

SELECT pg_temp.migrate_money_column('stock_entries', 'rate_per_ton');
SELECT pg_temp.migrate_money_column('sales_entries', 'turnover');
SELECT pg_temp.migrate_money_column('sales_entries', 'pntosa');
SELECT pg_temp.migrate_money_column('sales_entries', 'hydrazone');
SELECT pg_temp.migrate_money_column('sales_entry_lines', 'price_rupees');
SELECT pg_temp.migrate_money_column('sales_leads', 'expected_value');
SELECT pg_temp.migrate_money_column('sales_documents', 'total_amount');
SELECT pg_temp.migrate_money_column('sales_expenses', 'amount');
SELECT pg_temp.migrate_money_column('pmc_reference_prices', 'price');
SELECT pg_temp.migrate_money_column('pmc_product_params', 'overhead');
SELECT pg_temp.migrate_money_column('io_products', 'rate');
SELECT pg_temp.migrate_money_column('io_inward_items', 'price');
SELECT pg_temp.migrate_money_column('io_outward_items', 'price');
SELECT pg_temp.migrate_money_column('io_domestic_items', 'price');
SELECT pg_temp.migrate_money_column('io_international_items', 'price');
SELECT pg_temp.migrate_money_column('io_quotation_items', 'price');

DROP FUNCTION pg_temp.migrate_money_column(text, text);
DROP FUNCTION pg_temp.drop_checks_on_column(text, text);

COMMIT;
