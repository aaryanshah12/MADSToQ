-- ============================================================
-- PMC PORTAL — Full reset (v2 + factory scoping)
-- Run entire script in Supabase SQL Editor.
--
-- ALREADY HAVE v2 tables with data? Do NOT run this file.
-- Use: pmc-v2-to-factory-migration.sql (adds factory_id in place).
--
-- WARNING: Drops ALL existing PMC tables and data.
-- Requires: public.factories, public.profiles, public.profile_factories
--           (from main supabase-schema.sql).
--
-- Data is scoped per factory. Users see rows only for factories
-- assigned in profile_factories (owners see all factories).
-- PMC allowlist (pmc_users) still required to use the portal.
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── DROP ALL PMC TABLES (dependency order) ─────────────────
-- (Do not DROP TRIGGER on legacy tables — PG errors if the table is missing.)
drop table if exists public.pmc_batch_lines cascade;
drop table if exists public.pmc_batches cascade;
drop table if exists public.pmc_product_params cascade;
drop table if exists public.pmc_reference_prices cascade;
drop table if exists public.pmc_product_materials cascade;
drop table if exists public.pmc_references cascade;
drop table if exists public.pmc_products cascade;
drop table if exists public.pmc_raw_materials cascade;
drop table if exists public.pmc_user_store cascade;
drop table if exists public.pmc_users cascade;
drop function if exists public.can_access_pmc_factory(uuid);
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

-- Factory access: PMC allowlist + profile_factories (owners: all factories)
create or replace function public.can_access_pmc_factory(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_pmc_user()
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid() and p.role = 'owner'
      )
      or exists (
        select 1 from public.profile_factories pf
        where pf.profile_id = auth.uid() and pf.factory_id = fid
      )
    );
$$;

-- ─── PROCUREMENT (stored in pmc_raw_materials) ──────────────
create table public.pmc_raw_materials (
  id          uuid primary key default gen_random_uuid(),
  factory_id  uuid not null references public.factories(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  code        text not null,
  name        text not null,
  price       numeric(14,4) not null default 0,
  item_type   text not null default 'material'
    check (item_type in ('service', 'material')),
  vendor      text,
  description text,
  unit        text not null default 'Kg',
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (factory_id, code)
);

-- ─── PRODUCTS ───────────────────────────────────────────────
create table public.pmc_products (
  id          uuid primary key default gen_random_uuid(),
  factory_id  uuid not null references public.factories(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  code        text,
  unit_price  numeric(14,4) not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (factory_id, name)
);

-- ─── PRODUCT BOM (recipe per product) ───────────────────────
create table public.pmc_product_materials (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references public.pmc_products(id) on delete cascade,
  raw_material_id uuid not null references public.pmc_raw_materials(id) on delete restrict,
  qty             numeric(14,4) not null check (qty > 0),
  is_primary      boolean not null default false,
  sort_order      int not null default 0,
  unique (product_id, raw_material_id)
);

-- ─── BATCHES (frozen BOM + prices per run) ──────────────────
create table public.pmc_batches (
  id          uuid primary key default gen_random_uuid(),
  factory_id  uuid not null references public.factories(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  batch_code  text not null,
  status      text not null default 'draft'
    check (status in ('draft', 'active', 'completed', 'cancelled')),
  product_id  uuid not null references public.pmc_products(id) on delete restrict,
  batch_size  numeric(14,4) not null default 1 check (batch_size > 0),
  unit_price  numeric(14,4) not null default 0,
  created_at  timestamptz not null default now(),
  unique (factory_id, batch_code)
);

create table public.pmc_batch_lines (
  id              uuid primary key default gen_random_uuid(),
  batch_id        uuid not null references public.pmc_batches(id) on delete cascade,
  raw_material_id uuid references public.pmc_raw_materials(id) on delete set null,
  item_code       text not null default '',
  item_name       text not null default '',
  item_type       text not null default 'material'
    check (item_type in ('service', 'material')),
  qty             numeric(14,4) not null default 0 check (qty >= 0),
  unit_price      numeric(14,4) not null default 0,
  is_primary      boolean not null default false,
  sort_order      int not null default 0
);

-- ─── INDEXES ────────────────────────────────────────────────
create index idx_pmc_raw_materials_factory on public.pmc_raw_materials(factory_id);
create index idx_pmc_products_factory on public.pmc_products(factory_id);
create index idx_pmc_batches_factory on public.pmc_batches(factory_id);
create index idx_pmc_batches_product on public.pmc_batches(product_id);
create index idx_pmc_batch_lines_batch on public.pmc_batch_lines(batch_id);

-- ─── ROW LEVEL SECURITY ─────────────────────────────────────
alter table public.pmc_users enable row level security;
alter table public.pmc_raw_materials enable row level security;
alter table public.pmc_products enable row level security;
alter table public.pmc_product_materials enable row level security;
alter table public.pmc_batches enable row level security;
alter table public.pmc_batch_lines enable row level security;

create policy "pmc_users_select_own"
  on public.pmc_users for select
  using (auth.uid() = user_id);

create policy "pmc_raw_materials_factory"
  on public.pmc_raw_materials for all
  using (can_access_pmc_factory(factory_id))
  with check (can_access_pmc_factory(factory_id));

create policy "pmc_products_factory"
  on public.pmc_products for all
  using (can_access_pmc_factory(factory_id))
  with check (can_access_pmc_factory(factory_id));

create policy "pmc_product_materials_factory"
  on public.pmc_product_materials for all
  using (
    exists (
      select 1 from public.pmc_products p
      where p.id = product_id and can_access_pmc_factory(p.factory_id)
    )
    and exists (
      select 1 from public.pmc_raw_materials rm
      where rm.id = raw_material_id and can_access_pmc_factory(rm.factory_id)
    )
  )
  with check (
    exists (
      select 1 from public.pmc_products p
      where p.id = product_id and can_access_pmc_factory(p.factory_id)
    )
    and exists (
      select 1 from public.pmc_raw_materials rm
      where rm.id = raw_material_id and can_access_pmc_factory(rm.factory_id)
    )
  );

create policy "pmc_batches_factory"
  on public.pmc_batches for all
  using (can_access_pmc_factory(factory_id))
  with check (can_access_pmc_factory(factory_id));

create policy "pmc_batch_lines_factory"
  on public.pmc_batch_lines for all
  using (
    exists (
      select 1 from public.pmc_batches b
      where b.id = batch_id and can_access_pmc_factory(b.factory_id)
    )
  )
  with check (
    exists (
      select 1 from public.pmc_batches b
      where b.id = batch_id and can_access_pmc_factory(b.factory_id)
    )
  );

-- ─── GRANTS ─────────────────────────────────────────────────
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.is_pmc_user() to authenticated;
grant execute on function public.can_access_pmc_factory(uuid) to authenticated;

-- ─── GRANT PMC ACCESS ─────────────────────────────────────────
-- insert into public.pmc_users (user_id, full_name, email, is_active)
-- select id, 'Your Name', email, true
-- from auth.users where lower(email) = lower('you@company.com')
-- on conflict (user_id) do update set is_active = true, full_name = excluded.full_name;
--
-- Assign factories in profile_factories (Inventory admin) so the user
-- can access that factory's PMC data.
--
-- Or: node scripts/register-pmc-user.js you@company.com --allowlist-only 'Your Name'

-- App pricing notes:
-- Product template unit_price = SUM(recipe_qty × current procurement price)
-- Batch unit_price = SUM(recipe_qty × batch_size × frozen line unit_price)
-- Updating procurement price does NOT change existing batch lines.
