-- PMC module for Neon (Auth.js + Prisma). Run after neon-platform.sql.

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists pmc_users (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references users(id) on delete cascade,
  full_name  text not null,
  email      text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id)
);

create table if not exists pmc_raw_materials (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references users(id) on delete cascade,
  name       text not null,
  unit       text not null default 'Kg',
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists pmc_products (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references users(id) on delete cascade,
  name       text not null,
  code       text,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table if not exists pmc_product_materials (
  id              uuid primary key default gen_random_uuid(),
  product_id      uuid not null references pmc_products(id) on delete cascade,
  raw_material_id uuid not null references pmc_raw_materials(id) on delete restrict,
  qty             numeric(14,4) not null check (qty > 0),
  is_primary      boolean not null default false,
  sort_order      int not null default 0,
  unique (product_id, raw_material_id)
);

create table if not exists pmc_references (
  id         uuid primary key default gen_random_uuid(),
  user_id    text not null references users(id) on delete cascade,
  ref_number text not null check (ref_number ~ '^REF-[0-9]{3}$'),
  notes      text,
  created_at timestamptz not null default now(),
  unique (user_id, ref_number)
);

create table if not exists pmc_reference_prices (
  id              uuid primary key default gen_random_uuid(),
  reference_id    uuid not null references pmc_references(id) on delete cascade,
  raw_material_id uuid not null references pmc_raw_materials(id) on delete restrict,
  price           numeric(14,4) not null default 0,
  unique (reference_id, raw_material_id)
);

create table if not exists pmc_product_params (
  id               uuid primary key default gen_random_uuid(),
  product_id       uuid not null references pmc_products(id) on delete cascade,
  reference_id     uuid not null references pmc_references(id) on delete cascade,
  overhead         numeric(14,4) not null default 0,
  batch_multiplier numeric(14,4) not null default 1,
  yield_value      numeric(14,4) not null default 1,
  updated_at       timestamptz not null default now(),
  unique (product_id, reference_id)
);

create index if not exists idx_pmc_raw_materials_user on pmc_raw_materials(user_id);
create index if not exists idx_pmc_products_user on pmc_products(user_id);
create index if not exists idx_pmc_references_user on pmc_references(user_id);

drop trigger if exists pmc_product_params_updated_at on pmc_product_params;
create trigger pmc_product_params_updated_at
  before update on pmc_product_params
  for each row execute procedure set_updated_at();

create or replace function pmc_grant_user(
  p_user_id text,
  p_name    text,
  p_email   text
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into pmc_users(user_id, full_name, email, is_active)
       values (p_user_id, p_name, p_email, true)
    on conflict (user_id) do update
      set is_active = true, full_name = excluded.full_name, email = excluded.email
    returning id into v_id;
  return v_id;
end;
$$;
