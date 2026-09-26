-- ============================================================
-- Tables the app uses that are not in the original schema files.
-- Run after supabase-schema.sql, sales-schema.sql, pmc-schema.sql,
-- and io-pdf-config.sql.
-- ============================================================

alter table public.factories
  add column if not exists materials text[];

-- ─── Inventory extras ─────────────────────────────────────
create table if not exists public.suppliers (
  id          uuid primary key default gen_random_uuid(),
  factory_id  uuid references public.factories(id) on delete cascade,
  name        text not null,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

create table if not exists public.factory_inout_products (
  id          uuid primary key default gen_random_uuid(),
  factory_id  uuid not null references public.factories(id) on delete cascade,
  kind        text not null check (kind in ('inward', 'outward')),
  name        text not null,
  is_active   boolean not null default true,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.inward_entries (
  id           uuid primary key default gen_random_uuid(),
  factory_id   uuid not null references public.factories(id) on delete cascade,
  product_id   uuid references public.factory_inout_products(id),
  product_name text,
  entry_date   date not null default current_date,
  tons         numeric(12,3) not null,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.outward_entries (
  id           uuid primary key default gen_random_uuid(),
  factory_id   uuid not null references public.factories(id) on delete cascade,
  product_id   uuid references public.factory_inout_products(id),
  product_name text,
  entry_date   date not null default current_date,
  batch_no     text,
  no_of_bags   numeric(12,3),
  as_is        numeric(12,3),
  purity       numeric(12,3),
  real         numeric(12,3),
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.monthly_material_entries (
  id              uuid primary key default gen_random_uuid(),
  factory_id      uuid not null references public.factories(id) on delete cascade,
  batch_id        text not null,
  month           int not null,
  fiscal_year     text not null,
  oleum_23        numeric(14,3),
  as_is_kg        numeric(14,3),
  purity_nv       numeric(14,3),
  free_acidity    numeric(14,3),
  actual_real_kg  numeric(14,3),
  used_pnt        numeric(14,3),
  yield_pct       numeric(14,3),
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.sales_entries (
  id           uuid primary key default gen_random_uuid(),
  fiscal_year  text not null,
  month        int not null,
  factory_id   uuid not null references public.factories(id) on delete cascade,
  turnover     numeric(14,2),
  pntosa       numeric(14,2),
  hydrazone    numeric(14,2),
  notes        text,
  created_by   uuid references public.profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (fiscal_year, month, factory_id)
);

create table if not exists public.sales_entry_lines (
  id              uuid primary key default gen_random_uuid(),
  sales_entry_id  uuid not null references public.sales_entries(id) on delete cascade,
  product_name    text not null,
  price_rupees    numeric(14,2),
  quantity_kg     numeric(14,3)
);

-- ─── Inward / Outward portal ──────────────────────────────
create table if not exists public.io_units (
  id           serial primary key,
  name         text not null,
  abbreviation text,
  created_at   timestamptz not null default now()
);

create table if not exists public.io_countries (
  id         serial primary key,
  name       text not null,
  code       text,
  created_at timestamptz not null default now()
);

create table if not exists public.io_states (
  id         serial primary key,
  country_id integer not null references public.io_countries(id) on delete cascade,
  name       text not null,
  code       text,
  created_at timestamptz not null default now()
);

create table if not exists public.io_cities (
  id         serial primary key,
  state_id   integer not null references public.io_states(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.io_companies (
  id           uuid primary key default gen_random_uuid(),
  factory_id   uuid references public.factories(id) on delete cascade,
  company_type text not null check (company_type in ('supplier', 'customer', 'both')),
  company_name text not null,
  person_name  text,
  country_id   integer references public.io_countries(id),
  state_id     integer references public.io_states(id),
  city_id      integer references public.io_cities(id),
  address      text,
  pincode      text,
  mobile       text,
  email        text,
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.io_products (
  id           uuid primary key default gen_random_uuid(),
  factory_id   uuid references public.factories(id) on delete cascade,
  product_name text not null,
  description  text,
  hsn_code     text,
  unit_id      integer references public.io_units(id),
  rate         numeric(14,2),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table if not exists public.io_numbering_config (
  factory_id uuid not null references public.factories(id) on delete cascade,
  doc_type   text not null,
  prefix     text not null default '',
  suffix     text not null default '',
  updated_at timestamptz not null default now(),
  primary key (factory_id, doc_type)
);

create table if not exists public.io_inward (
  id              uuid primary key default gen_random_uuid(),
  factory_id      uuid references public.factories(id) on delete cascade,
  inward_number   text not null,
  inward_date     date not null default current_date,
  supplier_id     uuid references public.io_companies(id),
  supplier_ref_no text,
  remarks         text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.io_inward_items (
  id         uuid primary key default gen_random_uuid(),
  inward_id  uuid not null references public.io_inward(id) on delete cascade,
  product_id uuid references public.io_products(id),
  quantity   numeric(14,3) not null default 0,
  price      numeric(14,2) not null default 0,
  remarks    text,
  sort_order integer not null default 0
);

create table if not exists public.io_outward (
  id              uuid primary key default gen_random_uuid(),
  factory_id      uuid references public.factories(id) on delete cascade,
  outward_number  text not null,
  outward_date    date not null default current_date,
  supplier_id     uuid references public.io_companies(id),
  supplier_ref_no text,
  remarks         text,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.io_outward_items (
  id         uuid primary key default gen_random_uuid(),
  outward_id uuid not null references public.io_outward(id) on delete cascade,
  product_id uuid references public.io_products(id),
  quantity   numeric(14,3) not null default 0,
  price      numeric(14,2) not null default 0,
  remarks    text,
  sort_order integer not null default 0
);

create table if not exists public.io_domestic (
  id                 uuid primary key default gen_random_uuid(),
  factory_id         uuid references public.factories(id) on delete cascade,
  invoice_number     text not null,
  tax_invoice_number text,
  invoice_date       date not null default current_date,
  customer_id        uuid references public.io_companies(id),
  remarks            text,
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.io_domestic_items (
  id         uuid primary key default gen_random_uuid(),
  domestic_id uuid not null references public.io_domestic(id) on delete cascade,
  product_id uuid references public.io_products(id),
  quantity   numeric(14,3) not null default 0,
  price      numeric(14,2) not null default 0,
  remarks    text,
  sort_order integer not null default 0
);

create table if not exists public.io_international (
  id                 uuid primary key default gen_random_uuid(),
  factory_id         uuid references public.factories(id) on delete cascade,
  invoice_number     text not null,
  tax_invoice_number text,
  invoice_date       date not null default current_date,
  customer_id        uuid references public.io_companies(id),
  remarks            text,
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.io_international_items (
  id               uuid primary key default gen_random_uuid(),
  international_id uuid not null references public.io_international(id) on delete cascade,
  product_id       uuid references public.io_products(id),
  quantity         numeric(14,3) not null default 0,
  price            numeric(14,2) not null default 0,
  remarks          text,
  sort_order       integer not null default 0
);

create table if not exists public.io_quotations (
  id               uuid primary key default gen_random_uuid(),
  factory_id       uuid references public.factories(id) on delete cascade,
  quotation_number text not null,
  quotation_date   date not null default current_date,
  customer_id      uuid references public.io_companies(id),
  outward_ref_no   text,
  header_content   text,
  footer_content   text,
  created_by       uuid references public.profiles(id),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create table if not exists public.io_quotation_items (
  id                    uuid primary key default gen_random_uuid(),
  quotation_id          uuid not null references public.io_quotations(id) on delete cascade,
  reference_no          text,
  product_id            uuid references public.io_products(id),
  product_name_override text,
  price                 numeric(14,2) not null default 0,
  sort_order            integer not null default 0
);

-- ─── Row level security ───────────────────────────────────
-- The API owner connection bypasses RLS. Signed-in requests
-- run as app_user, so these policies are what they see.

create or replace function public.app_can_access_factory(fid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    fid is null
    or public.get_my_role() = 'owner'
    or fid = any(public.get_my_factory_ids());
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'suppliers',
    'factory_inout_products',
    'inward_entries',
    'outward_entries',
    'monthly_material_entries',
    'sales_entries',
    'io_companies',
    'io_products',
    'io_numbering_config',
    'io_inward',
    'io_outward',
    'io_domestic',
    'io_international',
    'io_quotations'
  ]
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists app_factory_access on public.%I', t);
    execute format(
      'create policy app_factory_access on public.%I for all using (public.app_can_access_factory(factory_id)) with check (public.app_can_access_factory(factory_id))',
      t
    );
  end loop;
end
$$;

alter table public.sales_entry_lines enable row level security;
drop policy if exists app_sales_entry_lines_access on public.sales_entry_lines;
create policy app_sales_entry_lines_access on public.sales_entry_lines
  for all
  using (
    exists (
      select 1 from public.sales_entries e
      where e.id = sales_entry_id
        and public.app_can_access_factory(e.factory_id)
    )
  )
  with check (
    exists (
      select 1 from public.sales_entries e
      where e.id = sales_entry_id
        and public.app_can_access_factory(e.factory_id)
    )
  );

do $$
declare
  t text;
begin
  foreach t in array array['io_units', 'io_countries', 'io_states', 'io_cities']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists app_signed_in_access on public.%I', t);
    execute format(
      'create policy app_signed_in_access on public.%I for all using (auth.uid() is not null) with check (auth.uid() is not null)',
      t
    );
  end loop;
end
$$;

alter table public.io_inward_items enable row level security;
drop policy if exists app_io_inward_items_access on public.io_inward_items;
create policy app_io_inward_items_access on public.io_inward_items
  for all
  using (exists (select 1 from public.io_inward p where p.id = inward_id and public.app_can_access_factory(p.factory_id)))
  with check (exists (select 1 from public.io_inward p where p.id = inward_id and public.app_can_access_factory(p.factory_id)));

alter table public.io_outward_items enable row level security;
drop policy if exists app_io_outward_items_access on public.io_outward_items;
create policy app_io_outward_items_access on public.io_outward_items
  for all
  using (exists (select 1 from public.io_outward p where p.id = outward_id and public.app_can_access_factory(p.factory_id)))
  with check (exists (select 1 from public.io_outward p where p.id = outward_id and public.app_can_access_factory(p.factory_id)));

alter table public.io_domestic_items enable row level security;
drop policy if exists app_io_domestic_items_access on public.io_domestic_items;
create policy app_io_domestic_items_access on public.io_domestic_items
  for all
  using (exists (select 1 from public.io_domestic p where p.id = domestic_id and public.app_can_access_factory(p.factory_id)))
  with check (exists (select 1 from public.io_domestic p where p.id = domestic_id and public.app_can_access_factory(p.factory_id)));

alter table public.io_international_items enable row level security;
drop policy if exists app_io_international_items_access on public.io_international_items;
create policy app_io_international_items_access on public.io_international_items
  for all
  using (exists (select 1 from public.io_international p where p.id = international_id and public.app_can_access_factory(p.factory_id)))
  with check (exists (select 1 from public.io_international p where p.id = international_id and public.app_can_access_factory(p.factory_id)));

alter table public.io_quotation_items enable row level security;
drop policy if exists app_io_quotation_items_access on public.io_quotation_items;
create policy app_io_quotation_items_access on public.io_quotation_items
  for all
  using (exists (select 1 from public.io_quotations p where p.id = quotation_id and public.app_can_access_factory(p.factory_id)))
  with check (exists (select 1 from public.io_quotations p where p.id = quotation_id and public.app_can_access_factory(p.factory_id)));
