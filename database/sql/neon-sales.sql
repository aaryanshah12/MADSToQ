-- Sales module for Neon (Auth.js + Prisma). Run after neon-platform.sql.
-- Replaces Supabase auth.users references with public.users(id).

create extension if not exists "pgcrypto";

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists sales_orgs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique,
  email_from    text not null default 'sales@madstoq.com',
  email_cc      text default 'inquires@madstoq.com',
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists sales_users (
  id           uuid primary key default gen_random_uuid(),
  user_id      text not null references users(id) on delete cascade,
  org_id       uuid not null references sales_orgs(id) on delete cascade,
  full_name    text not null,
  email        text not null,
  phone        text,
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (user_id, org_id)
);

create table if not exists sales_leads (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references sales_orgs(id) on delete cascade,
  company_name        text not null,
  contact_person      text,
  email               text,
  phone               text,
  address             text,
  city                text,
  state               text,
  country             text,
  pincode             text,
  source              text,
  status              text not null default 'new'
                        check (status in ('new','contacted','qualified','proposal',
                                          'negotiation','won','lost','on_hold')),
  expected_value      numeric(14,2),
  expected_close_date date,
  notes               text,
  assigned_to         uuid references sales_users(id) on delete set null,
  created_by          uuid references sales_users(id) on delete set null,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

create table if not exists sales_lead_activities (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references sales_leads(id) on delete cascade,
  activity_type text not null
                  check (activity_type in ('note','call','email','meeting',
                                           'status_change','quotation','po','other')),
  title         text,
  body          text,
  meta          jsonb,
  created_by    uuid references sales_users(id) on delete set null,
  created_at    timestamptz default now()
);

create table if not exists sales_doc_counters (
  org_id        uuid not null references sales_orgs(id) on delete cascade,
  doc_type      text not null,
  fiscal_year   text not null,
  last_seq      int  not null default 0,
  primary key (org_id, doc_type, fiscal_year)
);

create or replace function sales_next_doc_number(p_org uuid, p_type text)
returns text language plpgsql as $$
declare
  fy     text;
  seq    int;
  prefix text;
begin
  fy := case
    when extract(month from current_date) >= 4
      then extract(year from current_date)::text || '-' ||
           lpad(((extract(year from current_date)::int + 1) % 100)::text, 2, '0')
    else (extract(year from current_date)::int - 1)::text || '-' ||
         lpad((extract(year from current_date)::int % 100)::text, 2, '0')
  end;

  insert into sales_doc_counters(org_id, doc_type, fiscal_year, last_seq)
       values (p_org, p_type, fy, 1)
  on conflict (org_id, doc_type, fiscal_year)
       do update set last_seq = sales_doc_counters.last_seq + 1
  returning last_seq into seq;

  prefix := case p_type
              when 'quotation'      then 'QT'
              when 'purchase_order' then 'PO'
              when 'invoice'        then 'INV'
              else upper(left(p_type, 3))
            end;

  return prefix || '/' || fy || '/' || lpad(seq::text, 4, '0');
end;
$$;

create table if not exists sales_documents (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references sales_orgs(id) on delete cascade,
  lead_id           uuid references sales_leads(id) on delete set null,
  doc_type          text not null check (doc_type in ('quotation','purchase_order','invoice')),
  doc_number        text not null,
  doc_date          date not null default current_date,
  to_company        text,
  to_contact_person text,
  to_email          text,
  to_phone          text,
  to_address        text,
  subject           text,
  body_html         text,
  body_json         jsonb,
  total_amount      numeric(14,2),
  currency          text default 'INR',
  status            text not null default 'draft'
                      check (status in ('draft','sent','accepted','declined','cancelled')),
  pdf_path          text,
  pdf_url           text,
  sent_at           timestamptz,
  sent_to           text,
  sent_cc           text,
  email_message_id  text,
  created_by        uuid references sales_users(id) on delete set null,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (org_id, doc_type, doc_number)
);

create table if not exists sales_expenses (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references sales_orgs(id) on delete cascade,
  title         text not null,
  description   text,
  category      text,
  amount        numeric(14,2) not null check (amount >= 0),
  currency      text default 'INR',
  expense_date  date not null default current_date,
  paid_by       uuid not null references sales_users(id),
  split_method  text not null default 'equal'
                  check (split_method in ('equal','custom','percent')),
  receipt_path  text,
  receipt_url   text,
  notes         text,
  created_by    uuid references sales_users(id) on delete set null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create table if not exists sales_expense_splits (
  id                uuid primary key default gen_random_uuid(),
  expense_id        uuid not null references sales_expenses(id) on delete cascade,
  user_id           uuid not null references sales_users(id) on delete cascade,
  share_amount      numeric(14,2) not null check (share_amount >= 0),
  share_percent     numeric(6,3),
  is_settled        boolean default false,
  settled_at        timestamptz,
  settled_by        uuid references sales_users(id) on delete set null,
  last_reminder_at  timestamptz,
  reminder_count    int default 0,
  created_at        timestamptz default now(),
  unique (expense_id, user_id)
);

create table if not exists sales_notifications (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references sales_orgs(id) on delete cascade,
  user_id             uuid not null references sales_users(id) on delete cascade,
  kind                text not null,
  title               text not null,
  body                text,
  link_url            text,
  related_expense_id  uuid references sales_expenses(id) on delete cascade,
  related_split_id    uuid references sales_expense_splits(id) on delete cascade,
  related_lead_id     uuid references sales_leads(id) on delete cascade,
  related_document_id uuid references sales_documents(id) on delete cascade,
  is_read             boolean default false,
  read_at             timestamptz,
  created_at          timestamptz default now()
);

create index if not exists idx_sales_users_user on sales_users(user_id);
create index if not exists idx_sales_leads_org on sales_leads(org_id);
create index if not exists idx_sales_documents_org on sales_documents(org_id);
create index if not exists idx_sales_expenses_org on sales_expenses(org_id);
create index if not exists idx_sales_notifications_user on sales_notifications(user_id, is_read, created_at desc);

drop trigger if exists sales_orgs_updated on sales_orgs;
create trigger sales_orgs_updated before update on sales_orgs for each row execute procedure set_updated_at();
drop trigger if exists sales_users_updated on sales_users;
create trigger sales_users_updated before update on sales_users for each row execute procedure set_updated_at();
drop trigger if exists sales_leads_updated on sales_leads;
create trigger sales_leads_updated before update on sales_leads for each row execute procedure set_updated_at();
drop trigger if exists sales_documents_updated on sales_documents;
create trigger sales_documents_updated before update on sales_documents for each row execute procedure set_updated_at();
drop trigger if exists sales_expenses_updated on sales_expenses;
create trigger sales_expenses_updated before update on sales_expenses for each row execute procedure set_updated_at();

-- Expense split notification trigger (simplified, no auth.uid)
create or replace function sales_notify_on_split_insert()
returns trigger language plpgsql as $$
declare
  v_org    uuid;
  v_title  text;
  v_payer  text;
begin
  select e.org_id, coalesce(e.title, 'Expense'), coalesce(p.full_name, 'Someone')
    into v_org, v_title, v_payer
    from sales_expenses e
    left join sales_users p on p.id = e.paid_by
   where e.id = new.expense_id;

  if (select paid_by from sales_expenses where id = new.expense_id) = new.user_id then
    return new;
  end if;

  insert into sales_notifications (org_id, user_id, kind, title, body, related_expense_id, related_split_id)
  values (
    v_org, new.user_id, 'expense_added',
    v_payer || ' added you to "' || v_title || '"',
    'Your share is Rs. ' || trim(to_char(new.share_amount, 'FM999G999G990D00')),
    new.expense_id, new.id
  );
  return new;
end;
$$;

drop trigger if exists sales_split_added_notify on sales_expense_splits;
create trigger sales_split_added_notify
  after insert on sales_expense_splits
  for each row execute procedure sales_notify_on_split_insert();

create or replace function sales_grant_user(
  p_user_id text,
  p_org_id  uuid,
  p_name    text,
  p_email   text
) returns uuid language plpgsql as $$
declare v_id uuid;
begin
  insert into sales_users(user_id, org_id, full_name, email, is_active)
       values (p_user_id, p_org_id, p_name, p_email, true)
    on conflict (user_id, org_id) do update
      set is_active = true, full_name = excluded.full_name, email = excluded.email
    returning id into v_id;
  return v_id;
end;
$$;
