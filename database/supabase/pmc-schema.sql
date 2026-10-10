-- ============================================================
-- PMC PORTAL — Full reset + per-user isolated schema
-- Run entire script in Supabase SQL Editor.
--
-- WARNING: Drops all existing PMC tables and data.
-- Each auth user only sees their own rows (RLS + user_id).
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── DROP EXISTING (dependency order) ───────────────────────
drop trigger if exists pmc_product_params_updated_at on public.pmc_product_params;
drop table if exists public.pmc_product_params cascade;
drop table if exists public.pmc_reference_prices cascade;
drop table if exists public.pmc_product_materials cascade;
drop table if exists public.pmc_references cascade;
drop table if exists public.pmc_products cascade;
drop table if exists public.pmc_raw_materials cascade;
drop table if exists public.pmc_user_store cascade;
drop table if exists public.pmc_users cascade;
drop function if exists public.is_pmc_user();

-- ─── HELPERS ────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── PMC USERS (allowlist for /pmc login) ───────────────────
create table public.pmc_users (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  full_name  text not null,
  email      text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id)
);

-- Portal access: user must have an active row in pmc_users (after table exists)
create or replace function public.is_pmc_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.pmc_users
    where user_id = auth.uid()
      and is_active = true
  );
$$;

-- ─── RAW MATERIALS (per user) ───────────────────────────────
create table public.pmc_raw_materials (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  unit       text not null default 'Kg',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ─── PRODUCTS (per user) ─────────────────────────────────────
create table public.pmc_products (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  code       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

-- ─── PRODUCT ↔ RAW MATERIAL (BOM) ───────────────────────────
create table public.pmc_product_materials (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.pmc_products(id) on delete cascade,
  raw_material_id uuid not null references public.pmc_raw_materials(id) on delete restrict,
  qty             numeric(14,4) not null check (qty > 0),
  is_primary      boolean not null default false,
  sort_order      int not null default 0,
  unique (product_id, raw_material_id)
);

-- ─── REFERENCE (price snapshot, per user) ───────────────────
-- ref_number sequential per user: REF-001, REF-002, …
create table public.pmc_references (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  ref_number text not null check (ref_number ~ '^REF-[0-9]{3}$'),
  notes      text,
  created_at timestamptz not null default now(),
  unique (user_id, ref_number)
);

create table public.pmc_reference_prices (
  id              uuid primary key default gen_random_uuid(),
  reference_id    uuid not null references public.pmc_references(id) on delete cascade,
  raw_material_id uuid not null references public.pmc_raw_materials(id) on delete restrict,
  price           numeric(14,4) not null default 0,
  unique (reference_id, raw_material_id)
);

-- ─── PRODUCT PARAMS PER REFERENCE ───────────────────────────
create table public.pmc_product_params (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references public.pmc_products(id) on delete cascade,
  reference_id     uuid not null references public.pmc_references(id) on delete cascade,
  overhead         numeric(14,4) not null default 0,
  batch_multiplier numeric(14,4) not null default 1,
  yield_value      numeric(14,4) not null default 1,
  updated_at       timestamptz not null default now(),
  unique (product_id, reference_id)
);

-- ─── INDEXES ────────────────────────────────────────────────
create index idx_pmc_raw_materials_user on public.pmc_raw_materials(user_id);
create index idx_pmc_products_user on public.pmc_products(user_id);
create index idx_pmc_references_user_created on public.pmc_references(user_id, created_at desc);
create index idx_pmc_params_product on public.pmc_product_params(product_id);

create trigger pmc_product_params_updated_at
  before update on public.pmc_product_params
  for each row execute function public.set_updated_at();

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
alter table public.pmc_users enable row level security;
alter table public.pmc_raw_materials enable row level security;
alter table public.pmc_products enable row level security;
alter table public.pmc_product_materials enable row level security;
alter table public.pmc_references enable row level security;
alter table public.pmc_reference_prices enable row level security;
alter table public.pmc_product_params enable row level security;

-- pmc_users: each person sees only their allowlist row
create policy "pmc_users_select_own"
  on public.pmc_users for select
  using (auth.uid() = user_id);

-- Root tables: own rows only
create policy "pmc_raw_materials_own"
  on public.pmc_raw_materials for all
  using (is_pmc_user() and user_id = auth.uid())
  with check (is_pmc_user() and user_id = auth.uid());

create policy "pmc_products_own"
  on public.pmc_products for all
  using (is_pmc_user() and user_id = auth.uid())
  with check (is_pmc_user() and user_id = auth.uid());

create policy "pmc_references_own"
  on public.pmc_references for all
  using (is_pmc_user() and user_id = auth.uid())
  with check (is_pmc_user() and user_id = auth.uid());

-- Child tables: row visible only if parent(s) belong to auth.uid()
create policy "pmc_product_materials_own"
  on public.pmc_product_materials for all
  using (
    is_pmc_user()
    and exists (
      select 1 from public.pmc_products p
      where p.id = product_id and p.user_id = auth.uid()
    )
    and exists (
      select 1 from public.pmc_raw_materials rm
      where rm.id = raw_material_id and rm.user_id = auth.uid()
    )
  )
  with check (
    is_pmc_user()
    and exists (
      select 1 from public.pmc_products p
      where p.id = product_id and p.user_id = auth.uid()
    )
    and exists (
      select 1 from public.pmc_raw_materials rm
      where rm.id = raw_material_id and rm.user_id = auth.uid()
    )
  );

create policy "pmc_reference_prices_own"
  on public.pmc_reference_prices for all
  using (
    is_pmc_user()
    and exists (
      select 1 from public.pmc_references r
      where r.id = reference_id and r.user_id = auth.uid()
    )
    and exists (
      select 1 from public.pmc_raw_materials rm
      where rm.id = raw_material_id and rm.user_id = auth.uid()
    )
  )
  with check (
    is_pmc_user()
    and exists (
      select 1 from public.pmc_references r
      where r.id = reference_id and r.user_id = auth.uid()
    )
    and exists (
      select 1 from public.pmc_raw_materials rm
      where rm.id = raw_material_id and rm.user_id = auth.uid()
    )
  );

create policy "pmc_product_params_own"
  on public.pmc_product_params for all
  using (
    is_pmc_user()
    and exists (
      select 1 from public.pmc_products p
      where p.id = product_id and p.user_id = auth.uid()
    )
    and exists (
      select 1 from public.pmc_references r
      where r.id = reference_id and r.user_id = auth.uid()
    )
  )
  with check (
    is_pmc_user()
    and exists (
      select 1 from public.pmc_products p
      where p.id = product_id and p.user_id = auth.uid()
    )
    and exists (
      select 1 from public.pmc_references r
      where r.id = reference_id and r.user_id = auth.uid()
    )
  );

-- ─── GRANT ACCESS (authenticated Supabase clients) ───────────
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_pmc_user() to authenticated;

-- ─── GRANT PMC ACCESS (existing Auth users from other portals) ─
-- Same pattern as sales_users: one shared Supabase login; each portal
-- has its own allowlist table. Run pmc-register-owner.sql or:
--
-- insert into public.pmc_users (user_id, full_name, email, is_active)
-- select id, 'Factory Owner', email, true
-- from auth.users where lower(email) = lower('owner@factory.com')
-- on conflict (user_id) do update set is_active = true;
--
-- Allowlist only (no password change):
--   node scripts/register-pmc-user.js owner@factory.com --allowlist-only 'Factory Owner'

-- RMC formula (app layer):
-- effective_qty = recipe_qty * batch_multiplier
-- material_total = SUM(effective_qty * reference_price.price)
-- primary_effective_qty = primary_recipe_qty * batch_multiplier
-- real_final_product = yield_value * primary_effective_qty
-- unit_before_overhead = material_total / real_final_product
-- final_rmc = unit_before_overhead + overhead
