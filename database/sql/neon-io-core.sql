-- IO module (inward / outward / quotation) — no domestic or international tables.
-- Run after neon-io-auth.sql (or neon-platform.sql + neon-inventory-erp.sql).

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists io_units (
  id serial primary key,
  name text not null,
  abbreviation text,
  created_at timestamptz default now()
);

create table if not exists io_countries (
  id serial primary key,
  name text not null,
  code text,
  created_at timestamptz default now()
);

create table if not exists io_states (
  id serial primary key,
  country_id int not null references io_countries(id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz default now()
);

create table if not exists io_cities (
  id serial primary key,
  state_id int not null references io_states(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

create table if not exists io_companies (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid references factories(id) on delete set null,
  company_type text not null check (company_type in ('supplier','customer','both')),
  company_name text not null,
  person_title text,
  person_name text,
  country_id int references io_countries(id),
  state_id int references io_states(id),
  city_id int references io_cities(id),
  address text,
  pincode text,
  mobile text,
  email text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists io_products (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid references factories(id) on delete set null,
  product_name text not null,
  description text,
  hsn_code text,
  unit_id int references io_units(id),
  rate numeric(14,4),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists io_numbering_config (
  factory_id uuid not null references factories(id) on delete cascade,
  doc_type text not null,
  prefix text default '',
  suffix text default '',
  number_format text not null default 'standard',
  updated_at timestamptz default now(),
  primary key (factory_id, doc_type)
);

create table if not exists io_inward (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid references factories(id) on delete set null,
  inward_number text not null,
  inward_date date not null,
  supplier_id uuid references io_companies(id),
  supplier_ref_no text,
  remarks text,
  created_by text references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists io_inward_items (
  id uuid primary key default gen_random_uuid(),
  inward_id uuid not null references io_inward(id) on delete cascade,
  product_id uuid not null references io_products(id),
  quantity numeric(14,4) not null default 0,
  price numeric(14,4) not null default 0,
  remarks text,
  sort_order int default 0
);

create table if not exists io_outward (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid references factories(id) on delete set null,
  outward_number text not null,
  outward_date date not null,
  supplier_id uuid references io_companies(id),
  supplier_ref_no text,
  remarks text,
  created_by text references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists io_outward_items (
  id uuid primary key default gen_random_uuid(),
  outward_id uuid not null references io_outward(id) on delete cascade,
  product_id uuid not null references io_products(id),
  quantity numeric(14,4) not null default 0,
  price numeric(14,4) not null default 0,
  remarks text,
  sort_order int default 0
);

create table if not exists io_quotations (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid references factories(id) on delete set null,
  quotation_number text not null,
  quotation_date date not null,
  customer_id uuid references io_companies(id),
  outward_ref_no text,
  header_content text,
  footer_content text,
  created_by text references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists io_quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references io_quotations(id) on delete cascade,
  reference_no text,
  product_id uuid references io_products(id),
  product_name_override text,
  price numeric(14,4) not null default 0,
  price_unit text not null default 'INR/KG',
  sort_order int default 0
);

create index if not exists idx_io_companies_factory on io_companies(factory_id);
create index if not exists idx_io_inward_factory on io_inward(factory_id);
create index if not exists idx_io_outward_factory on io_outward(factory_id);
