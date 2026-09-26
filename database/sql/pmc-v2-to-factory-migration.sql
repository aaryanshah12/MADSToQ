-- ============================================================
-- PMC v2 → factory scoping (IN-PLACE, keeps your data)
--
-- Use this when you already ran v2 tables (procurement, products,
-- batches) WITHOUT factory_id, and want factory access — do NOT
-- re-run pmc-schema.sql (that wipes everything).
--
-- Requires: factories, profiles, profile_factories, pmc_users,
--           is_pmc_user(), and existing pmc_* v2 tables.
-- ============================================================

create extension if not exists "pgcrypto";

-- ─── 1) Factory access helper ───────────────────────────────
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

grant execute on function public.can_access_pmc_factory(uuid) to authenticated;

-- ─── 2) Add factory_id (nullable until backfill) ─────────────
alter table public.pmc_raw_materials
  add column if not exists factory_id uuid references public.factories(id) on delete cascade;

alter table public.pmc_products
  add column if not exists factory_id uuid references public.factories(id) on delete cascade;

alter table public.pmc_batches
  add column if not exists factory_id uuid references public.factories(id) on delete cascade;

-- ─── 3) Backfill: row owner's first assigned factory ────────
update public.pmc_raw_materials rm
set factory_id = sub.factory_id
from (
  select distinct on (rm2.id)
    rm2.id as row_id,
    pf.factory_id
  from public.pmc_raw_materials rm2
  join public.profile_factories pf on pf.profile_id = rm2.user_id
  where rm2.factory_id is null
  order by rm2.id, pf.factory_id
) sub
where rm.id = sub.row_id;

update public.pmc_products p
set factory_id = sub.factory_id
from (
  select distinct on (p2.id)
    p2.id as row_id,
    pf.factory_id
  from public.pmc_products p2
  join public.profile_factories pf on pf.profile_id = p2.user_id
  where p2.factory_id is null
  order by p2.id, pf.factory_id
) sub
where p.id = sub.row_id;

update public.pmc_batches b
set factory_id = sub.factory_id
from (
  select distinct on (b2.id)
    b2.id as row_id,
    pf.factory_id
  from public.pmc_batches b2
  join public.profile_factories pf on pf.profile_id = b2.user_id
  where b2.factory_id is null
  order by b2.id, pf.factory_id
) sub
where b.id = sub.row_id;

-- Fallback: any row still null → first factory in system (edit if needed)
update public.pmc_raw_materials
set factory_id = (select id from public.factories order by name limit 1)
where factory_id is null;

update public.pmc_products
set factory_id = (select id from public.factories order by name limit 1)
where factory_id is null;

update public.pmc_batches
set factory_id = (select id from public.factories order by name limit 1)
where factory_id is null;

-- Fail fast if still null (no factories table / empty)
do $$
begin
  if exists (select 1 from public.pmc_raw_materials where factory_id is null) then
    raise exception 'pmc_raw_materials: factory_id still null — assign profile_factories or insert a factory';
  end if;
  if exists (select 1 from public.pmc_products where factory_id is null) then
    raise exception 'pmc_products: factory_id still null';
  end if;
  if exists (select 1 from public.pmc_batches where factory_id is null) then
    raise exception 'pmc_batches: factory_id still null';
  end if;
end $$;

alter table public.pmc_raw_materials alter column factory_id set not null;
alter table public.pmc_products alter column factory_id set not null;
alter table public.pmc_batches alter column factory_id set not null;

-- ─── 4) Indexes ─────────────────────────────────────────────
create index if not exists idx_pmc_raw_materials_factory on public.pmc_raw_materials(factory_id);
create index if not exists idx_pmc_products_factory on public.pmc_products(factory_id);
create index if not exists idx_pmc_batches_factory on public.pmc_batches(factory_id);

-- ─── 5) Uniques: per-user → per-factory ─────────────────────
alter table public.pmc_raw_materials drop constraint if exists pmc_raw_materials_user_id_code_key;
alter table public.pmc_products drop constraint if exists pmc_products_user_id_name_key;
alter table public.pmc_batches drop constraint if exists pmc_batches_user_id_batch_code_key;

-- Supabase may auto-name constraints differently; drop by pattern
do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'pmc_raw_materials'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%user_id%code%'
  loop
    execute format('alter table public.pmc_raw_materials drop constraint if exists %I', r.conname);
  end loop;
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'pmc_products'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%user_id%name%'
  loop
    execute format('alter table public.pmc_products drop constraint if exists %I', r.conname);
  end loop;
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'pmc_batches'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) like '%user_id%batch_code%'
  loop
    execute format('alter table public.pmc_batches drop constraint if exists %I', r.conname);
  end loop;
end $$;

alter table public.pmc_raw_materials drop constraint if exists pmc_raw_materials_factory_id_code_key;
alter table public.pmc_products drop constraint if exists pmc_products_factory_id_name_key;
alter table public.pmc_batches drop constraint if exists pmc_batches_factory_id_batch_code_key;

alter table public.pmc_raw_materials add constraint pmc_raw_materials_factory_id_code_key unique (factory_id, code);
alter table public.pmc_products add constraint pmc_products_factory_id_name_key unique (factory_id, name);
alter table public.pmc_batches add constraint pmc_batches_factory_id_batch_code_key unique (factory_id, batch_code);

-- ─── 6) RLS: replace user-scoped policies ───────────────────
alter table public.pmc_raw_materials enable row level security;
alter table public.pmc_products enable row level security;
alter table public.pmc_product_materials enable row level security;
alter table public.pmc_batches enable row level security;
alter table public.pmc_batch_lines enable row level security;

drop policy if exists "pmc_raw_materials_own" on public.pmc_raw_materials;
drop policy if exists "pmc_products_own" on public.pmc_products;
drop policy if exists "pmc_product_materials_own" on public.pmc_product_materials;
drop policy if exists "pmc_batches_own" on public.pmc_batches;
drop policy if exists "pmc_batch_lines_own" on public.pmc_batch_lines;

drop policy if exists "pmc_raw_materials_factory" on public.pmc_raw_materials;
drop policy if exists "pmc_products_factory" on public.pmc_products;
drop policy if exists "pmc_product_materials_factory" on public.pmc_product_materials;
drop policy if exists "pmc_batches_factory" on public.pmc_batches;
drop policy if exists "pmc_batch_lines_factory" on public.pmc_batch_lines;

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

-- ─── Verify ─────────────────────────────────────────────────
-- select count(*), factory_id from pmc_raw_materials group by factory_id;
-- select count(*), factory_id from pmc_products group by factory_id;
-- select count(*), factory_id from pmc_batches group by factory_id;
