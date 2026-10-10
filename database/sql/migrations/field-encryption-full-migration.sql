-- =============================================================================
-- MADSTOQ — Field encryption: full migration (Neon / Supabase SQL Editor)
-- =============================================================================
-- 1) Drops views/columns that block type changes
-- 2) Converts money columns from NUMERIC → TEXT (values kept as plain text)
-- 3) OPTIONAL: wipes rows in affected tables (Section A) — enabled below
--
-- BACK UP YOUR DATABASE BEFORE RUNNING.
-- After this: set FIELD_ENCRYPTION_KEY, pnpm db:generate, restart app.
-- =============================================================================

BEGIN;

-- =============================================================================
-- SECTION A — WIPE DATA (destructive; comment out this entire block to keep rows)
-- =============================================================================

DO $wipe$
DECLARE
  tables text[] := ARRAY[
    -- IO (children → parents)
    'io_quotation_items',
    'io_quotations',
    'io_international_items',
    'io_international',
    'io_domestic_items',
    'io_domestic',
    'io_outward_items',
    'io_outward',
    'io_inward_items',
    'io_inward',
    'io_products',
    'io_companies',
    'io_numbering_config',
    'io_cities',
    'io_states',
    'io_countries',
    'io_units',
    -- PMC
    'pmc_product_params',
    'pmc_reference_prices',
    'pmc_references',
    'pmc_product_materials',
    'pmc_products',
    'pmc_raw_materials',
    'pmc_users',
    -- Personal sales
    'sales_expense_splits',
    'sales_expenses',
    'sales_documents',
    'sales_lead_activities',
    'sales_leads',
    'sales_notifications',
    'sales_entry_lines',
    'sales_entries',
    -- Inventory ERP
    'usage_entries',
    'stock_entries',
    'monthly_material_entries',
    'outward_entries',
    'inward_entries',
    'factory_inout_products',
    'suppliers'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY tables LOOP
    IF to_regclass(format('public.%I', t)) IS NOT NULL THEN
      EXECUTE format('TRUNCATE TABLE %I CASCADE', t);
      RAISE NOTICE 'Truncated %', t;
    END IF;
  END LOOP;
END $wipe$;

-- =============================================================================
-- SECTION B — Drop views / generated columns that block ALTER
-- =============================================================================

DROP VIEW IF EXISTS factory_summary CASCADE;

DO $drop_gen$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_entries'
      AND column_name = 'total_value'
      AND is_generated = 'ALWAYS'
  ) THEN
    ALTER TABLE stock_entries DROP COLUMN total_value;
    RAISE NOTICE 'Dropped stock_entries.total_value (generated column)';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'stock_entries'
      AND column_name = 'total_value'
  ) THEN
    ALTER TABLE stock_entries DROP COLUMN total_value;
    RAISE NOTICE 'Dropped stock_entries.total_value';
  END IF;
END $drop_gen$;

-- =============================================================================
-- SECTION C — Convert money columns to TEXT (preserves values as text)
-- =============================================================================

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
    RAISE NOTICE 'Skip % (table missing)', p_table;
    RETURN;
  END IF;

  SELECT c.data_type INTO col_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = p_table
    AND c.column_name = p_column;

  IF col_type IS NULL THEN
    RAISE NOTICE 'Skip %.% (column missing)', p_table, p_column;
    RETURN;
  END IF;

  IF col_type IN ('text', 'character varying') THEN
    RAISE NOTICE 'Skip %.% (already %)', p_table, p_column, col_type;
    RETURN;
  END IF;

  PERFORM pg_temp.drop_checks_on_column(p_table, p_column);

  EXECUTE format(
    'ALTER TABLE %I ALTER COLUMN %I TYPE TEXT USING %I::text',
    p_table, p_column, p_column
  );
  RAISE NOTICE 'Migrated %.% → TEXT', p_table, p_column;
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

-- =============================================================================
-- Done. factory_summary view was removed; stock value is computed in the app.
-- Re-seed if you truncated: pnpm db:seed / db:seed:erp / db:seed:io as needed.
-- =============================================================================
