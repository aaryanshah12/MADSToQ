-- Factory-scoped I/O PDF template settings (run in Supabase SQL editor)

create table if not exists io_pdf_config (
  factory_id  uuid not null references factories(id) on delete cascade,
  slot        text not null check (slot in ('label', 'letter-head', 'customer-print')),
  file_path   text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (factory_id, slot)
);

create table if not exists io_pdf_files (
  id          uuid primary key default gen_random_uuid(),
  factory_id  uuid not null references factories(id) on delete cascade,
  file_path   text not null,
  uploaded_at timestamptz not null default now(),
  unique (factory_id, file_path)
);

create index if not exists io_pdf_files_factory_idx on io_pdf_files (factory_id);

alter table io_pdf_config enable row level security;
alter table io_pdf_files enable row level security;

-- Service role / authenticated app uses server-side checks; allow authenticated read/write for assigned factories
create policy "io_pdf_config_factory_access"
  on io_pdf_config for all
  using (
    factory_id in (
      select factory_id from profile_factories where profile_id = auth.uid()
    )
  )
  with check (
    factory_id in (
      select factory_id from profile_factories where profile_id = auth.uid()
    )
  );

create policy "io_pdf_files_factory_access"
  on io_pdf_files for all
  using (
    factory_id in (
      select factory_id from profile_factories where profile_id = auth.uid()
    )
  )
  with check (
    factory_id in (
      select factory_id from profile_factories where profile_id = auth.uid()
    )
  );
