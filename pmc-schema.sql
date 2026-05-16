-- ============================================================
-- PMC PORTAL — Product Pricing System
-- Run in Supabase SQL Editor when migrating off localStorage.
-- Auth: any user with a row in pmc_users may access /pmc
-- ============================================================

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── PMC USERS (auth gate) ─────────────────────────────────
create table if not exists pmc_users (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  full_name  text not null,
  email      text not null,
  is_active  boolean default true,
  created_at timestamptz default now(),
  unique (user_id)
);

-- ─── RAW MATERIALS ─────────────────────────────────────────
create table if not exists pmc_raw_materials (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  unit       text not null default 'Kg',
  is_active  boolean default true,
  created_at timestamptz default now()
);

-- ─── PRODUCTS ──────────────────────────────────────────────
create table if not exists pmc_products (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  code       text,
  is_active  boolean default true,
  created_at timestamptz default now()
);

-- ─── PRODUCT ↔ RAW MATERIAL (BOM) ──────────────────────────
create table if not exists pmc_product_materials (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references pmc_products(id) on delete cascade,
  raw_material_id uuid not null references pmc_raw_materials(id),
  qty             numeric(14,4) not null check (qty > 0),
  sort_order      int not null default 0,
  unique (product_id, raw_material_id)
);

-- ─── REFERENCE (price snapshot) ────────────────────────────
create table if not exists pmc_references (
  id         uuid primary key default gen_random_uuid(),
  ref_number text not null unique,
  notes      text,
  created_at timestamptz default now()
);

create table if not exists pmc_reference_prices (
  id              uuid primary key default gen_random_uuid(),
  reference_id    uuid not null references pmc_references(id) on delete cascade,
  raw_material_id uuid not null references pmc_raw_materials(id),
  price           numeric(14,4) not null default 0,
  unique (reference_id, raw_material_id)
);

-- ─── PRODUCT PARAMS PER REFERENCE ────────────────────────
create table if not exists pmc_product_params (
  id           uuid primary key default gen_random_uuid(),
  product_id   uuid not null references pmc_products(id) on delete cascade,
  reference_id uuid not null references pmc_references(id) on delete cascade,
  overhead     numeric(14,4) not null default 0,
  tons_kg      numeric(14,4) not null default 0,
  yield_value  numeric(14,4) not null default 1,
  updated_at   timestamptz default now(),
  unique (product_id, reference_id)
);

create index if not exists idx_pmc_ref_created on pmc_references(created_at desc);
create index if not exists idx_pmc_params_product on pmc_product_params(product_id);

-- RMC formula (app layer):
-- material_total = SUM(product_material.qty * reference_price.price)
-- yield_divisor = yield_value * 100    (e.g. 10.8 → 1080)
-- unit_before_overhead = material_total / yield_divisor
-- final_rmc = unit_before_overhead + overhead
