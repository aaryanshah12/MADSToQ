-- Minimal auth + factories for the IO portal (no inventory stock, PMC, or sales).
-- Run before neon-io-core.sql. For full ERP, use neon-platform.sql + neon-inventory-erp.sql instead.

create extension if not exists "pgcrypto";

do $$ begin
  create type "UserRole" as enum ('OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type "ProfileRole" as enum ('owner', 'inputer', 'chemist', 'accountant');
exception when duplicate_object then null;
end $$;

create table if not exists clients (
  id         text primary key,
  slug       text not null unique,
  name       text not null,
  is_active  boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists users (
  id            text primary key,
  username      text unique,
  email         text not null unique,
  name          text not null,
  password_hash text,
  role          "UserRole" not null default 'OPERATOR',
  client_id     text not null references clients(id) on delete cascade,
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists users_client_id_idx on users(client_id);

create table if not exists factories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  location    text,
  materials   jsonb,
  is_active   boolean default true,
  created_at  timestamptz default now()
);

create table if not exists profiles (
  id          uuid primary key,
  full_name   text not null,
  email       text,
  phone       text,
  role        "ProfileRole" not null,
  is_active   boolean default true,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

create table if not exists profile_factories (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  factory_id  uuid not null references factories(id) on delete cascade,
  unique (profile_id, factory_id)
);

-- IO portal auth: each login user needs users.id = profiles.id (same UUID/text)
-- and at least one profile_factories row, or POST /api/rpc/io returns 403.
-- Example after inserting a user and factory:
--   insert into profiles (id, full_name, email, role) values ('<users.id>', 'IO Owner', 'owner@example.com', 'owner');
--   insert into profile_factories (profile_id, factory_id) values ('<users.id>', '<factories.id>');
