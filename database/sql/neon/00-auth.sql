-- ============================================================
-- Neon bootstrap — run this FIRST in the Neon SQL editor.
--
-- Then run, in order:
--   1. database/sql/supabase-schema.sql
--   2. database/sql/sales-schema.sql
--   3. database/sql/pmc-schema.sql
--   4. database/sql/io-pdf-config.sql
--   5. database/sql/neon/10-app-tables.sql
--   6. database/sql/neon/90-grants.sql
--
-- Do not run the pmc-v2 migration files on a fresh database.
-- pmc-schema.sql already creates the current PMC tables.
--
-- This script replaces Supabase Auth. Passwords are bcrypt
-- hashes stored in auth.users.encrypted_password. auth.uid()
-- reads the app.current_user_id setting that the API sets
-- for the signed-in user.
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "uuid-ossp";

create schema if not exists auth;

create table if not exists auth.users (
  id                 uuid primary key default gen_random_uuid(),
  email              text not null,
  encrypted_password text not null,
  raw_user_meta_data jsonb not null default '{}'::jsonb,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create unique index if not exists auth_users_email_lower_idx
  on auth.users (lower(email));

alter table auth.users enable row level security;

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.current_user_id', true), '')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_user') then
    create role app_user nologin;
  end if;
end
$$;

grant usage on schema auth to app_user;
grant execute on function auth.uid() to app_user;
grant app_user to current_user;
