-- Chemical factory ERP tables for Neon (no Supabase auth / RLS)
-- Run after platform Prisma migrations, or include in a single bootstrap.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ─── Factories & profiles ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS factories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  location    TEXT,
  materials   JSONB,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY,
  full_name   TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  role        "ProfileRole" NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profile_factories (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  factory_id  UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  UNIQUE (profile_id, factory_id)
);

CREATE TABLE IF NOT EXISTS permission_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id  UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  feature     TEXT NOT NULL,
  is_allowed  BOOLEAN NOT NULL,
  expires_at  TIMESTAMPTZ,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ─── Stock & usage ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS stock_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id      UUID NOT NULL REFERENCES factories(id),
  invoice_number  TEXT NOT NULL UNIQUE,
  supplier_name   TEXT NOT NULL,
  material_type   TEXT NOT NULL,
  tons_loaded     NUMERIC(10,3) NOT NULL,
  rate_per_ton    TEXT NOT NULL,
  -- total_value: computed in app (tons_loaded * rate_per_ton), not stored — supports encrypted rates
  vehicle_number  TEXT,
  driver_name     TEXT,
  entry_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  notes           TEXT,
  stock_grade     TEXT NOT NULL DEFAULT 'approved'
                    CHECK (stock_grade IN ('approved', 'rejected')),
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id      UUID NOT NULL REFERENCES factories(id),
  invoice_number  TEXT NOT NULL REFERENCES stock_entries(invoice_number),
  tons_used       NUMERIC(10,3) NOT NULL,
  process_id      TEXT,
  batch_notes     TEXT,
  shift           TEXT CHECK (shift IN ('morning', 'afternoon', 'night')),
  usage_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  batch_month     TEXT,
  batch_id        TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS suppliers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id  UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE
);

-- ─── Inward / outward ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS factory_inout_products (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id  UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  kind        TEXT NOT NULL,
  name        TEXT NOT NULL,
  is_active   BOOLEAN DEFAULT TRUE,
  created_by  UUID
);

CREATE TABLE IF NOT EXISTS inward_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id    UUID NOT NULL REFERENCES factories(id),
  product_id    UUID NOT NULL REFERENCES factory_inout_products(id),
  product_name  TEXT,
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  tons          NUMERIC(12,3) NOT NULL,
  created_by    UUID NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS outward_entries (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id    UUID NOT NULL REFERENCES factories(id),
  product_id    UUID NOT NULL REFERENCES factory_inout_products(id),
  product_name  TEXT,
  entry_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  batch_no      TEXT NOT NULL,
  no_of_bags    INT NOT NULL,
  as_is         NUMERIC(12,3) NOT NULL,
  purity        NUMERIC(8,3) NOT NULL,
  real          NUMERIC(12,3) NOT NULL,
  created_by    UUID NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS monthly_material_entries (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id      UUID NOT NULL REFERENCES factories(id),
  batch_id        TEXT NOT NULL,
  month           INT NOT NULL,
  fiscal_year     TEXT NOT NULL,
  oleum_23        NUMERIC(12,3),
  as_is_kg        NUMERIC(12,3),
  purity_nv       NUMERIC(8,3),
  free_acidity    NUMERIC(8,3),
  actual_real_kg  NUMERIC(12,3),
  used_pnt        NUMERIC(12,3),
  yield_pct       NUMERIC(8,4),
  created_by      UUID NOT NULL,
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS sales_entries (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiscal_year  TEXT NOT NULL,
  month        INT NOT NULL,
  factory_id   UUID NOT NULL REFERENCES factories(id),
  turnover     NUMERIC(14,2),
  pntosa       NUMERIC(14,2),
  hydrazone    NUMERIC(14,2),
  notes        TEXT,
  created_by   UUID NOT NULL,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (fiscal_year, month, factory_id)
);

CREATE TABLE IF NOT EXISTS sales_entry_lines (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sales_entry_id  UUID NOT NULL REFERENCES sales_entries(id) ON DELETE CASCADE,
  product_name    TEXT NOT NULL,
  price_rupees    NUMERIC(14,2),
  quantity_kg     NUMERIC(14,3)
);

-- ─── Triggers ───────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION erp_update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at();

DROP TRIGGER IF EXISTS stock_entries_updated_at ON stock_entries;
CREATE TRIGGER stock_entries_updated_at
  BEFORE UPDATE ON stock_entries FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at();

-- ─── Employees (HR directory) ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS employees (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  factory_id                  UUID NOT NULL REFERENCES factories(id) ON DELETE CASCADE,
  profile_id                  UUID UNIQUE REFERENCES profiles(id) ON DELETE SET NULL,
  employee_code               TEXT NOT NULL,
  full_name                   TEXT NOT NULL,
  father_name                 TEXT,
  gender                      TEXT,
  date_of_birth               DATE,
  department                  TEXT NOT NULL,
  designation                 TEXT NOT NULL,
  employment_type             TEXT NOT NULL DEFAULT 'permanent',
  employment_status           TEXT NOT NULL DEFAULT 'active',
  joining_date                DATE NOT NULL,
  leaving_date                DATE,
  phone                       TEXT,
  email                       TEXT,
  current_address             TEXT,
  permanent_address           TEXT,
  emergency_contact_name      TEXT,
  emergency_contact_phone     TEXT,
  emergency_contact_relation  TEXT,
  blood_group                 TEXT,
  pan                         TEXT,
  aadhaar                     TEXT,
  uan                         TEXT,
  pf_number                   TEXT,
  esi_number                  TEXT,
  bank_name                   TEXT,
  account_holder_name         TEXT,
  account_number              TEXT,
  ifsc                        TEXT,
  monthly_gross               TEXT,
  annual_ctc                  TEXT,
  basic_pay                   TEXT,
  pf_eligible                 BOOLEAN NOT NULL DEFAULT false,
  esi_eligible                BOOLEAN NOT NULL DEFAULT false,
  is_active                   BOOLEAN NOT NULL DEFAULT true,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (factory_id, employee_code)
);

CREATE TABLE IF NOT EXISTS employee_documents (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id  UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  doc_type     TEXT NOT NULL,
  title        TEXT,
  file_name    TEXT NOT NULL,
  mime_type    TEXT NOT NULL,
  size_bytes   INTEGER NOT NULL,
  file_bytes   BYTEA NOT NULL,
  uploaded_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS employees_updated_at ON employees;
CREATE TRIGGER employees_updated_at
  BEFORE UPDATE ON employees FOR EACH ROW EXECUTE FUNCTION erp_update_updated_at();
