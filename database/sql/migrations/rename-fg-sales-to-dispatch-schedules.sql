-- Rename FG sales tables so the same records can cover finished goods and byproduct.

DO $$
BEGIN
  IF to_regclass('public.fg_sales') IS NOT NULL
     AND to_regclass('public.dispatch_schedules') IS NULL THEN
    ALTER TABLE fg_sales RENAME TO dispatch_schedules;
  END IF;

  IF to_regclass('public.fg_sale_lots') IS NOT NULL
     AND to_regclass('public.dispatch_schedule_lots') IS NULL THEN
    ALTER TABLE fg_sale_lots RENAME TO dispatch_schedule_lots;
  END IF;
END $$;

ALTER INDEX IF EXISTS fg_sales_factory_id_idx RENAME TO dispatch_schedules_factory_id_idx;
ALTER INDEX IF EXISTS fg_sales_status_idx RENAME TO dispatch_schedules_status_idx;
ALTER INDEX IF EXISTS fg_sales_factory_id_status_idx RENAME TO dispatch_schedules_factory_id_status_idx;
ALTER INDEX IF EXISTS fg_sale_lots_sale_id_idx RENAME TO dispatch_schedule_lots_sale_id_idx;
ALTER INDEX IF EXISTS fg_sale_lots_invoice_number_idx RENAME TO dispatch_schedule_lots_invoice_number_idx;
