-- Platform tables (Prisma: clients, users, inventory_items, workflow_definitions)
-- Safe to re-run: uses IF NOT EXISTS where possible.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

DO $$ BEGIN
  CREATE TYPE "UserRole" AS ENUM ('OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ProfileRole" AS ENUM ('owner', 'inputer', 'chemist', 'accountant', 'plant_supervisor', 'warehouse_manager', 'lab_incharge');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS clients (
  id         TEXT PRIMARY KEY,
  slug       TEXT NOT NULL UNIQUE,
  name       TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT,
  role          "UserRole" NOT NULL DEFAULT 'OPERATOR',
  client_id     TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS users_client_id_idx ON users(client_id);

CREATE TABLE IF NOT EXISTS inventory_items (
  id          TEXT PRIMARY KEY,
  client_id   TEXT NOT NULL,
  sku         TEXT NOT NULL,
  name        TEXT NOT NULL,
  description TEXT,
  unit        TEXT NOT NULL DEFAULT 'pcs',
  quantity    DECIMAL(18,4) NOT NULL DEFAULT 0,
  is_active   BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, sku)
);

CREATE INDEX IF NOT EXISTS inventory_items_client_id_idx ON inventory_items(client_id);

CREATE TABLE IF NOT EXISTS workflow_definitions (
  id         TEXT PRIMARY KEY,
  client_id  TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  key        TEXT NOT NULL,
  name       TEXT NOT NULL,
  version    INT NOT NULL DEFAULT 1,
  config     JSONB NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (client_id, key, version)
);
