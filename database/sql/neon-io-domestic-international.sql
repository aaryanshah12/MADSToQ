-- Optional IO add-on: domestic + international invoices.
-- Run after neon-io-core.sql (or full neon-io.sql already includes these).

create table if not exists io_domestic (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid references factories(id) on delete set null,
  invoice_number text not null,
  tax_invoice_number text,
  invoice_date date not null,
  customer_id uuid references io_companies(id),
  remarks text,
  created_by text references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists io_domestic_items (
  id uuid primary key default gen_random_uuid(),
  domestic_id uuid not null references io_domestic(id) on delete cascade,
  product_id uuid not null references io_products(id),
  quantity numeric(14,4) not null default 0,
  price numeric(14,4) not null default 0,
  remarks text,
  sort_order int default 0
);

create table if not exists io_international (
  id uuid primary key default gen_random_uuid(),
  factory_id uuid references factories(id) on delete set null,
  invoice_number text not null,
  tax_invoice_number text,
  invoice_date date not null,
  customer_id uuid references io_companies(id),
  remarks text,
  created_by text references users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists io_international_items (
  id uuid primary key default gen_random_uuid(),
  international_id uuid not null references io_international(id) on delete cascade,
  product_id uuid not null references io_products(id),
  quantity numeric(14,4) not null default 0,
  price numeric(14,4) not null default 0,
  remarks text,
  sort_order int default 0
);
