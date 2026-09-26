-- ============================================================
-- CHEMICAL FACTORY PORTAL — SUPABASE DATABASE SCHEMA
-- Run this entire file in Supabase SQL Editor
-- ============================================================

-- ─── EXTENSIONS ───────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── FACTORIES ────────────────────────────────────────────
create table factories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- ─── PROFILES (extends Supabase auth.users) ───────────────
create table profiles (
  id          uuid references auth.users(id) on delete cascade primary key,
  full_name   text not null,
  email       text,
  phone       text,
  role        text not null check (role in ('owner', 'inputer', 'chemist')),
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ─── PROFILE ↔ FACTORY ASSIGNMENTS ───────────────────────
create table profile_factories (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references profiles(id) on delete cascade,
  factory_id  uuid references factories(id) on delete cascade,
  unique(profile_id, factory_id)
);

-- ─── PERMISSION OVERRIDES ─────────────────────────────────
create table permission_overrides (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid references profiles(id) on delete cascade,
  feature     text not null,
  is_allowed  boolean not null,
  expires_at  timestamptz,
  created_by  uuid references profiles(id),
  created_at  timestamptz default now()
);

-- ─── STOCK ENTRIES (by Inputer) ───────────────────────────
create table stock_entries (
  id              uuid primary key default gen_random_uuid(),
  factory_id      uuid references factories(id),
  invoice_number  text not null unique,
  supplier_name   text not null,
  material_type   text not null,
  tons_loaded     numeric(10,3) not null,
  rate_per_ton    numeric(10,2) not null,   -- HIDDEN from chemist via RLS
  total_value     numeric(12,2) generated always as (tons_loaded * rate_per_ton) stored,
  vehicle_number  text,
  driver_name     text,
  entry_date      date not null default current_date,
  notes           text,
  created_by      uuid references profiles(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ─── USAGE ENTRIES (by Chemist) ───────────────────────────
create table usage_entries (
  id              uuid primary key default gen_random_uuid(),
  factory_id      uuid references factories(id),
  invoice_number  text references stock_entries(invoice_number),
  tons_used       numeric(10,3) not null,
  process_id      text,
  batch_notes     text,
  shift           text check (shift in ('morning', 'afternoon', 'night')),
  usage_date      date not null default current_date,
  created_by      uuid references profiles(id),
  created_at      timestamptz default now()
);

-- ─── SAFE VIEW FOR CHEMISTS (no financial data) ───────────
create or replace view stock_entries_safe
  with (security_invoker = false)
as
  select
    id,
    factory_id,
    invoice_number,
    supplier_name,
    material_type,
    tons_loaded,
    entry_date,
    notes
  from stock_entries;

-- ─── STOCK BALANCE VIEW ───────────────────────────────────
create or replace view stock_balance
  with (security_invoker = false)
as
  select
    s.factory_id,
    f.name as factory_name,
    s.invoice_number,
    s.material_type,
    s.tons_loaded,
    coalesce(sum(u.tons_used), 0) as tons_used,
    s.tons_loaded - coalesce(sum(u.tons_used), 0) as tons_remaining,
    s.entry_date
  from stock_entries s
  left join usage_entries u on u.invoice_number = s.invoice_number
  join factories f on f.id = s.factory_id
  group by s.id, f.name;

-- ─── FACTORY SUMMARY VIEW (for Owner dashboard) ───────────
create or replace view factory_summary
  with (security_invoker = false)
as
  select
    f.id as factory_id,
    f.name as factory_name,
    count(distinct s.id) as total_invoices,
    coalesce(sum(s.tons_loaded), 0) as total_tons_loaded,
    coalesce(sum(u_agg.tons_used), 0) as total_tons_used,
    coalesce(sum(s.tons_loaded), 0) - coalesce(sum(u_agg.tons_used), 0) as closing_balance,
    coalesce(sum(s.total_value), 0) as total_stock_value
  from factories f
  left join stock_entries s on s.factory_id = f.id
  left join (
    select invoice_number, sum(tons_used) as tons_used
    from usage_entries group by invoice_number
  ) u_agg on u_agg.invoice_number = s.invoice_number
  group by f.id, f.name;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table profiles           enable row level security;
alter table factories          enable row level security;
alter table profile_factories  enable row level security;
alter table permission_overrides enable row level security;
alter table stock_entries      enable row level security;
alter table usage_entries      enable row level security;

-- Helper function: get current user's role
create or replace function get_my_role()
returns text language sql security definer stable as $$
  select role from profiles where id = auth.uid()
$$;

-- Helper function: get current user's factory ids
create or replace function get_my_factory_ids()
returns uuid[] language sql security definer stable as $$
  select array_agg(factory_id)
  from profile_factories
  where profile_id = auth.uid()
$$;

-- ─── PROFILES POLICIES ────────────────────────────────────
create policy "users_read_own_profile"
  on profiles for select
  using (id = auth.uid());

create policy "owner_read_all_profiles"
  on profiles for select
  using (get_my_role() = 'owner');

create policy "owner_manage_profiles"
  on profiles for all
  using (get_my_role() = 'owner');

-- ─── FACTORIES POLICIES ───────────────────────────────────
create policy "all_read_assigned_factories"
  on factories for select
  using (
    get_my_role() = 'owner'
    or id = any(get_my_factory_ids())
  );

create policy "owner_manage_factories"
  on factories for all
  using (get_my_role() = 'owner');

-- ─── STOCK ENTRIES POLICIES ───────────────────────────────
-- Owner and Inputer: full access to their factories
create policy "owner_full_stock_access"
  on stock_entries for all
  using (get_my_role() = 'owner');

create policy "inputer_own_factory_stock"
  on stock_entries for all
  using (
    get_my_role() = 'inputer'
    and factory_id = any(get_my_factory_ids())
  );

-- Chemist: NO direct access to stock_entries (use stock_entries_safe view instead)
-- The view strips rate_per_ton and total_value

-- ─── USAGE ENTRIES POLICIES ───────────────────────────────
create policy "owner_full_usage_access"
  on usage_entries for all
  using (get_my_role() = 'owner');

create policy "chemist_own_factory_usage"
  on usage_entries for all
  using (
    get_my_role() = 'chemist'
    and factory_id = any(get_my_factory_ids())
  );

create policy "inputer_read_usage"
  on usage_entries for select
  using (
    get_my_role() = 'inputer'
    and factory_id = any(get_my_factory_ids())
  );

-- ─── PROFILE_FACTORIES POLICIES ────────────────────────────────────────────
create policy "owner_read_all_profile_factories"
  on profile_factories for select
  using (get_my_role() = 'owner');

create policy "owner_manage_profile_factories"
  on profile_factories for all
  using (get_my_role() = 'owner');

create policy "users_read_own_profile_factories"
  on profile_factories for select
  using (profile_id = auth.uid());

-- ─── PERMISSION OVERRIDES POLICIES ───────────────────────
create policy "owner_manage_permissions"
  on permission_overrides for all
  using (get_my_role() = 'owner');

create policy "users_read_own_permissions"
  on permission_overrides for select
  using (profile_id = auth.uid());

-- ============================================================
-- TRIGGERS
-- ============================================================

-- Auto-create profile on signup
create or replace function handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, full_name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'chemist')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on profiles
  for each row execute procedure update_updated_at();

create trigger stock_entries_updated_at
  before update on stock_entries
  for each row execute procedure update_updated_at();

-- ============================================================
-- SEED DATA — Insert sample factories
-- ============================================================
insert into factories (name, location) values
  ('Factory Alpha', 'Ahmedabad, Gujarat'),
  ('Factory Beta',  'Surat, Gujarat'),
  ('Factory Gamma', 'Vadodara, Gujarat');
