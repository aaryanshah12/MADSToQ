-- ============================================================
-- SALES MODULE — SUPABASE DATABASE SCHEMA
-- Path: madstoq.com/personal/sales/...
-- Run this entire file in Supabase SQL Editor.
-- This file is independent of supabase-schema.sql (Inventory/IO).
-- A user gets access to /personal/sales ONLY if a row exists for
-- them in `sales_users`. Manually insert that row to grant access.
-- ============================================================

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- Reuse existing helper if present, otherwise create a local copy.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ============================================================
-- TABLES
-- ============================================================

-- ─── SALES ORGS ───────────────────────────────────────────
-- A Sales org is independent of the Inventory `factories` table.
-- Email defaults are per-org so a different org could use a
-- different `from`/`cc` later. Default values match MADSToQ.
create table if not exists sales_orgs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique,                       -- nice for URLs (optional)
  email_from    text not null default 'sales@madstoq.com',
  email_cc      text          default 'inquires@madstoq.com',
  is_active     boolean       default true,
  created_at    timestamptz   default now(),
  updated_at    timestamptz   default now()
);

-- ─── SALES USERS (auth gate) ──────────────────────────────
-- A row here is REQUIRED for a Supabase auth.user to access
-- /personal/sales. Inventory permissions are unrelated.
-- One auth user can belong to multiple sales orgs.
-- No role hierarchy: every active sales user is a peer.
create table if not exists sales_users (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  org_id       uuid not null references sales_orgs(id) on delete cascade,
  full_name    text not null,
  email        text not null,
  phone        text,
  is_active    boolean default true,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  unique (user_id, org_id)
);

-- ─── LEADS ────────────────────────────────────────────────
-- No master data: contact info is captured fresh per lead.
create table if not exists sales_leads (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references sales_orgs(id) on delete cascade,

  -- inline contact (no master)
  company_name        text not null,
  contact_person      text,
  email               text,
  phone               text,
  address             text,
  city                text,
  state               text,
  country             text,
  pincode             text,

  source              text,                  -- 'web', 'referral', 'event', etc.
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

-- ─── LEAD ACTIVITIES (timeline) ───────────────────────────
create table if not exists sales_lead_activities (
  id            uuid primary key default gen_random_uuid(),
  lead_id       uuid not null references sales_leads(id) on delete cascade,
  activity_type text not null
                  check (activity_type in ('note','call','email','meeting',
                                           'status_change','quotation','po','other')),
  title         text,
  body          text,
  meta          jsonb,                       -- e.g. {old_status, new_status, doc_id}
  created_by    uuid references sales_users(id) on delete set null,
  created_at    timestamptz default now()
);

-- ─── DOCUMENT NUMBERING (per org / type / fiscal year) ────
create table if not exists sales_doc_counters (
  org_id        uuid not null references sales_orgs(id) on delete cascade,
  doc_type      text not null,                -- 'quotation' | 'purchase_order' | 'invoice'
  fiscal_year   text not null,                -- '2025-26'
  last_seq      int  not null default 0,
  primary key (org_id, doc_type, fiscal_year)
);

-- Returns next number atomically: e.g. 'QT/2025-26/0007'
create or replace function sales_next_doc_number(p_org uuid, p_type text)
returns text language plpgsql security definer as $$
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

-- ─── DOCUMENTS (Quotation / PO / Invoice) ─────────────────
-- Body lives in body_html (fallback) and body_json (TipTap) so we
-- can render the same content into PDF and HTML email.
create table if not exists sales_documents (
  id                uuid primary key default gen_random_uuid(),
  org_id            uuid not null references sales_orgs(id) on delete cascade,
  lead_id           uuid references sales_leads(id) on delete set null,

  doc_type          text not null check (doc_type in ('quotation','purchase_order','invoice')),
  doc_number        text not null,
  doc_date          date not null default current_date,

  -- recipient snapshot at time of generation
  to_company        text,
  to_contact_person text,
  to_email          text,
  to_phone          text,
  to_address        text,

  subject           text,
  body_html         text,                       -- HTML produced by RTE
  body_json         jsonb,                      -- TipTap doc (or any RTE JSON)
  total_amount      numeric(14,2),
  currency          text default 'INR',

  status            text not null default 'draft'
                      check (status in ('draft','sent','accepted','declined','cancelled')),

  pdf_path          text,                       -- supabase storage path
  pdf_url           text,                       -- public/signed URL

  sent_at           timestamptz,
  sent_to           text,                       -- comma separated
  sent_cc           text,
  email_message_id  text,

  created_by        uuid references sales_users(id) on delete set null,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  unique (org_id, doc_type, doc_number)
);

-- ─── EXPENSES + SPLITS ────────────────────────────────────
create table if not exists sales_expenses (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid not null references sales_orgs(id) on delete cascade,

  title         text not null,
  description   text,
  category      text,                           -- 'travel', 'meals', etc.
  amount        numeric(14,2) not null check (amount >= 0),
  currency      text default 'INR',
  expense_date  date not null default current_date,

  paid_by       uuid not null references sales_users(id),

  split_method  text not null default 'equal'
                  check (split_method in ('equal','custom','percent')),

  receipt_path  text,                           -- supabase storage path
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

-- ─── NOTIFICATIONS (in-app) ───────────────────────────────
create table if not exists sales_notifications (
  id                  uuid primary key default gen_random_uuid(),
  org_id              uuid not null references sales_orgs(id) on delete cascade,
  user_id             uuid not null references sales_users(id) on delete cascade,
  kind                text not null check (kind in (
                        'expense_added',
                        'expense_reminder',
                        'expense_settled',
                        'lead_assigned',
                        'document_sent',
                        'other')),
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

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_sales_users_user           on sales_users(user_id);
create index if not exists idx_sales_users_org            on sales_users(org_id);

create index if not exists idx_sales_leads_org            on sales_leads(org_id);
create index if not exists idx_sales_leads_status         on sales_leads(status);
create index if not exists idx_sales_leads_assigned       on sales_leads(assigned_to);
create index if not exists idx_sales_leads_created_at     on sales_leads(created_at desc);

create index if not exists idx_sales_lead_activities_lead on sales_lead_activities(lead_id);

create index if not exists idx_sales_documents_org        on sales_documents(org_id);
create index if not exists idx_sales_documents_lead       on sales_documents(lead_id);
create index if not exists idx_sales_documents_type       on sales_documents(org_id, doc_type);

create index if not exists idx_sales_expenses_org         on sales_expenses(org_id);
create index if not exists idx_sales_expenses_paid_by     on sales_expenses(paid_by);
create index if not exists idx_sales_expense_splits_exp   on sales_expense_splits(expense_id);
create index if not exists idx_sales_expense_splits_user  on sales_expense_splits(user_id);

create index if not exists idx_sales_notifications_user   on sales_notifications(user_id, is_read, created_at desc);
create index if not exists idx_sales_notifications_org    on sales_notifications(org_id);

-- ============================================================
-- TRIGGERS
-- ============================================================
drop trigger if exists sales_orgs_updated      on sales_orgs;
drop trigger if exists sales_users_updated     on sales_users;
drop trigger if exists sales_leads_updated     on sales_leads;
drop trigger if exists sales_documents_updated on sales_documents;
drop trigger if exists sales_expenses_updated  on sales_expenses;

create trigger sales_orgs_updated      before update on sales_orgs      for each row execute procedure set_updated_at();
create trigger sales_users_updated     before update on sales_users     for each row execute procedure set_updated_at();
create trigger sales_leads_updated     before update on sales_leads     for each row execute procedure set_updated_at();
create trigger sales_documents_updated before update on sales_documents for each row execute procedure set_updated_at();
create trigger sales_expenses_updated  before update on sales_expenses  for each row execute procedure set_updated_at();

-- ─── NOTIFY USERS WHEN ADDED TO AN EXPENSE ────────────────
create or replace function sales_notify_on_split_insert()
returns trigger language plpgsql security definer as $$
declare
  v_org    uuid;
  v_title  text;
  v_amt    numeric;
  v_payer  text;
begin
  select e.org_id,
         coalesce(e.title, 'Expense'),
         e.amount,
         coalesce(p.full_name, 'Someone')
    into v_org, v_title, v_amt, v_payer
    from sales_expenses e
    left join sales_users p on p.id = e.paid_by
   where e.id = new.expense_id;

  -- Don't notify the payer themselves.
  if (select paid_by from sales_expenses where id = new.expense_id) = new.user_id then
    return new;
  end if;

  insert into sales_notifications (
    org_id, user_id, kind, title, body,
    related_expense_id, related_split_id
  ) values (
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

-- ─── SETTLE A SPLIT (creator-only, callable from UI) ──────
-- Marks one user's split as settled. Only the expense creator
-- may call this; otherwise it raises an exception.
create or replace function sales_settle_split(p_split_id uuid)
returns sales_expense_splits language plpgsql security definer as $$
declare
  v_row sales_expense_splits%rowtype;
  v_exp sales_expenses%rowtype;
  v_me  uuid;
begin
  select * into v_row from sales_expense_splits where id = p_split_id;
  if not found then
    raise exception 'split not found';
  end if;

  select * into v_exp from sales_expenses where id = v_row.expense_id;
  v_me := get_my_sales_user_id(v_exp.org_id);

  if v_exp.created_by is null or v_exp.created_by <> v_me then
    raise exception 'only the expense creator can settle splits';
  end if;

  update sales_expense_splits
     set is_settled = true,
         settled_at = now(),
         settled_by = v_me
   where id = p_split_id
   returning * into v_row;

  insert into sales_notifications (
    org_id, user_id, kind, title, body,
    related_expense_id, related_split_id
  ) values (
    v_exp.org_id, v_row.user_id, 'expense_settled',
    'Marked as settled',
    '"' || coalesce(v_exp.title, 'Expense') || '" settled.',
    v_exp.id, v_row.id
  );

  return v_row;
end;
$$;

-- Settle every unpaid split on an expense at once (creator-only).
create or replace function sales_settle_all_splits(p_expense_id uuid)
returns int language plpgsql security definer as $$
declare
  v_exp sales_expenses%rowtype;
  v_me  uuid;
  v_n   int;
begin
  select * into v_exp from sales_expenses where id = p_expense_id;
  if not found then raise exception 'expense not found'; end if;

  v_me := get_my_sales_user_id(v_exp.org_id);
  if v_exp.created_by is null or v_exp.created_by <> v_me then
    raise exception 'only the expense creator can settle splits';
  end if;

  with upd as (
    update sales_expense_splits
       set is_settled = true,
           settled_at = now(),
           settled_by = v_me
     where expense_id = p_expense_id
       and is_settled = false
     returning id, user_id
  ),
  notify as (
    insert into sales_notifications (
      org_id, user_id, kind, title, body,
      related_expense_id, related_split_id
    )
    select v_exp.org_id, u.user_id, 'expense_settled',
           'Marked as settled',
           '"' || coalesce(v_exp.title, 'Expense') || '" settled.',
           v_exp.id, u.id
      from upd u
    returning 1
  )
  select count(*) into v_n from notify;
  return coalesce(v_n, 0);
end;
$$;

-- Send a reminder to a single split (anyone can nudge, not just creator).
create or replace function sales_send_split_reminder(p_split_id uuid)
returns sales_expense_splits language plpgsql security definer as $$
declare
  v_row sales_expense_splits%rowtype;
  v_exp sales_expenses%rowtype;
begin
  select * into v_row from sales_expense_splits where id = p_split_id;
  if not found then raise exception 'split not found'; end if;

  select * into v_exp from sales_expenses where id = v_row.expense_id;

  if not (v_exp.org_id = any (get_my_sales_org_ids())) then
    raise exception 'not a member of this org';
  end if;

  if v_row.is_settled then
    raise exception 'split already settled';
  end if;

  update sales_expense_splits
     set last_reminder_at = now(),
         reminder_count   = coalesce(reminder_count, 0) + 1
   where id = p_split_id
   returning * into v_row;

  insert into sales_notifications (
    org_id, user_id, kind, title, body,
    related_expense_id, related_split_id
  ) values (
    v_exp.org_id, v_row.user_id, 'expense_reminder',
    'Reminder: payment pending',
    'Please settle Rs. ' || trim(to_char(v_row.share_amount, 'FM999G999G990D00')) ||
      ' for "' || coalesce(v_exp.title, 'Expense') || '".',
    v_exp.id, v_row.id
  );

  return v_row;
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table sales_orgs            enable row level security;
alter table sales_users           enable row level security;
alter table sales_leads           enable row level security;
alter table sales_lead_activities enable row level security;
alter table sales_documents       enable row level security;
alter table sales_expenses        enable row level security;
alter table sales_expense_splits  enable row level security;
alter table sales_doc_counters    enable row level security;
alter table sales_notifications   enable row level security;

-- Helpers
create or replace function get_my_sales_org_ids()
returns uuid[] language sql security definer stable as $$
  select coalesce(array_agg(org_id), '{}'::uuid[])
    from sales_users
   where user_id = auth.uid()
     and is_active = true
$$;

-- The sales_users.id (membership row id) for the caller in a given org.
create or replace function get_my_sales_user_id(p_org uuid)
returns uuid language sql security definer stable as $$
  select id from sales_users
   where user_id = auth.uid() and org_id = p_org and is_active = true
   limit 1
$$;

-- ─── ORGS ─────────────────────────────────────────────────
drop policy if exists sales_orgs_member_read on sales_orgs;
create policy sales_orgs_member_read
  on sales_orgs for select
  using (id = any (get_my_sales_org_ids()));

drop policy if exists sales_orgs_member_write on sales_orgs;
create policy sales_orgs_member_write
  on sales_orgs for update
  using (id = any (get_my_sales_org_ids()));

-- ─── USERS ────────────────────────────────────────────────
-- A user can read their own row + everyone in the orgs they belong to.
-- Membership rows are inserted/updated outside RLS by the manual
-- provisioning function `sales_grant_user` (security definer).
drop policy if exists sales_users_member_read on sales_users;
create policy sales_users_member_read
  on sales_users for select
  using (
    user_id = auth.uid()
    or org_id = any (get_my_sales_org_ids())
  );

-- ─── LEADS ────────────────────────────────────────────────
drop policy if exists sales_leads_org_access on sales_leads;
create policy sales_leads_org_access
  on sales_leads for all
  using      (org_id = any (get_my_sales_org_ids()))
  with check (org_id = any (get_my_sales_org_ids()));

-- ─── LEAD ACTIVITIES ──────────────────────────────────────
drop policy if exists sales_lead_activities_org_access on sales_lead_activities;
create policy sales_lead_activities_org_access
  on sales_lead_activities for all
  using (
    exists (
      select 1 from sales_leads l
       where l.id = sales_lead_activities.lead_id
         and l.org_id = any (get_my_sales_org_ids())
    )
  )
  with check (
    exists (
      select 1 from sales_leads l
       where l.id = sales_lead_activities.lead_id
         and l.org_id = any (get_my_sales_org_ids())
    )
  );

-- ─── DOCUMENTS ────────────────────────────────────────────
drop policy if exists sales_documents_org_access on sales_documents;
create policy sales_documents_org_access
  on sales_documents for all
  using      (org_id = any (get_my_sales_org_ids()))
  with check (org_id = any (get_my_sales_org_ids()));

-- ─── COUNTERS ─────────────────────────────────────────────
drop policy if exists sales_doc_counters_org_access on sales_doc_counters;
create policy sales_doc_counters_org_access
  on sales_doc_counters for all
  using      (org_id = any (get_my_sales_org_ids()))
  with check (org_id = any (get_my_sales_org_ids()));

-- ─── EXPENSES ─────────────────────────────────────────────
-- All org members can read all org expenses.
drop policy if exists sales_expenses_org_read on sales_expenses;
create policy sales_expenses_org_read
  on sales_expenses for select
  using (org_id = any (get_my_sales_org_ids()));

-- Any active member can create an expense for their org.
drop policy if exists sales_expenses_member_insert on sales_expenses;
create policy sales_expenses_member_insert
  on sales_expenses for insert
  with check (org_id = any (get_my_sales_org_ids()));

-- Only the creator of the expense can edit/delete it.
drop policy if exists sales_expenses_creator_modify on sales_expenses;
create policy sales_expenses_creator_modify
  on sales_expenses for update
  using (
    org_id = any (get_my_sales_org_ids())
    and created_by is not null
    and created_by = get_my_sales_user_id(org_id)
  )
  with check (
    org_id = any (get_my_sales_org_ids())
    and created_by = get_my_sales_user_id(org_id)
  );

drop policy if exists sales_expenses_creator_delete on sales_expenses;
create policy sales_expenses_creator_delete
  on sales_expenses for delete
  using (
    org_id = any (get_my_sales_org_ids())
    and created_by is not null
    and created_by = get_my_sales_user_id(org_id)
  );

-- ─── EXPENSE SPLITS ───────────────────────────────────────
-- Any member of the same org can read splits for visibility.
drop policy if exists sales_expense_splits_read on sales_expense_splits;
create policy sales_expense_splits_read
  on sales_expense_splits for select
  using (
    exists (
      select 1 from sales_expenses e
       where e.id = sales_expense_splits.expense_id
         and e.org_id = any (get_my_sales_org_ids())
    )
  );

-- Insert/delete (i.e., shaping the split list) is restricted to the
-- expense creator. Mark-as-settled (an UPDATE) is also creator-only —
-- that satisfies the "creator marks it complete for one or all" rule.
drop policy if exists sales_expense_splits_creator_write on sales_expense_splits;
create policy sales_expense_splits_creator_write
  on sales_expense_splits for all
  using (
    exists (
      select 1 from sales_expenses e
       where e.id = sales_expense_splits.expense_id
         and e.org_id = any (get_my_sales_org_ids())
         and e.created_by = get_my_sales_user_id(e.org_id)
    )
  )
  with check (
    exists (
      select 1 from sales_expenses e
       where e.id = sales_expense_splits.expense_id
         and e.org_id = any (get_my_sales_org_ids())
         and e.created_by = get_my_sales_user_id(e.org_id)
    )
  );

-- ─── NOTIFICATIONS ────────────────────────────────────────
-- A user reads only their own notifications.
drop policy if exists sales_notifications_owner_read on sales_notifications;
create policy sales_notifications_owner_read
  on sales_notifications for select
  using (user_id = get_my_sales_user_id(org_id));

-- A user can mark their own notifications as read (UPDATE only).
drop policy if exists sales_notifications_owner_update on sales_notifications;
create policy sales_notifications_owner_update
  on sales_notifications for update
  using      (user_id = get_my_sales_user_id(org_id))
  with check (user_id = get_my_sales_user_id(org_id));

-- Notifications are normally inserted by the trigger below
-- (security definer), but allow members to insert too — useful for
-- ad-hoc reminders sent from the UI.
drop policy if exists sales_notifications_member_insert on sales_notifications;
create policy sales_notifications_member_insert
  on sales_notifications for insert
  with check (org_id = any (get_my_sales_org_ids()));

-- ============================================================
-- VIEWS
-- ============================================================

-- Per-user balance for an expense: what they owe vs what they paid.
create or replace view sales_expense_user_balance as
  select
    e.org_id,
    e.id          as expense_id,
    s.user_id     as sales_user_id,
    s.share_amount,
    case when e.paid_by = s.user_id
         then e.amount - s.share_amount       -- they paid; others owe them this much
         else -s.share_amount                  -- they owe this much
    end as net_amount,
    s.is_settled
  from sales_expenses e
  join sales_expense_splits s on s.expense_id = e.id;

-- Pipeline summary per org / status
create or replace view sales_pipeline_summary as
  select
    org_id,
    status,
    count(*)                                   as lead_count,
    coalesce(sum(expected_value), 0)           as expected_value_total
  from sales_leads
  group by org_id, status;

-- ============================================================
-- STORAGE BUCKETS (run once)
-- ============================================================
-- Create two buckets in Supabase Storage UI (or via SQL below):
--   sales-pdfs       (private)  - generated quotation/PO/invoice PDFs
--   sales-receipts   (private)  - expense receipts
-- Bucket policies should require the caller to be an authenticated
-- sales user. Example (Supabase Storage UI is easier):
--   insert into storage.buckets (id, name, public) values
--     ('sales-pdfs',     'sales-pdfs',     false),
--     ('sales-receipts', 'sales-receipts', false)
--   on conflict (id) do nothing;

-- ============================================================
-- BOOTSTRAP HELPERS
-- ============================================================

-- Create an org and (optionally) attach an existing auth user.
-- Usage:
--   select sales_bootstrap_org('MADSToQ', 'sales@madstoq.com', 'inquires@madstoq.com',
--                              '<auth.users.id>', 'Raj', 'raj@madstoq.com');
create or replace function sales_bootstrap_org(
  p_name             text,
  p_email_from       text default 'sales@madstoq.com',
  p_email_cc         text default 'inquires@madstoq.com',
  p_first_user_uid   uuid default null,
  p_first_user_name  text default null,
  p_first_user_email text default null
) returns uuid language plpgsql security definer as $$
declare
  v_org uuid;
begin
  insert into sales_orgs(name, email_from, email_cc)
       values (p_name, p_email_from, p_email_cc)
    returning id into v_org;

  if p_first_user_uid is not null then
    insert into sales_users(user_id, org_id, full_name, email, is_active)
         values (p_first_user_uid, v_org,
                 coalesce(p_first_user_name,  'Sales User'),
                 coalesce(p_first_user_email, ''),
                 true);
  end if;

  return v_org;
end;
$$;

-- Add a sales user manually (the only way users get access):
--   select sales_grant_user('<auth.users.id>', '<org_id>', 'Name', 'name@x.com');
create or replace function sales_grant_user(
  p_user_id uuid,
  p_org_id  uuid,
  p_name    text,
  p_email   text
) returns uuid language plpgsql security definer as $$
declare
  v_id uuid;
begin
  insert into sales_users(user_id, org_id, full_name, email, is_active)
       values (p_user_id, p_org_id, p_name, p_email, true)
    on conflict (user_id, org_id) do update
      set is_active = true,
          full_name = excluded.full_name,
          email     = excluded.email
    returning id into v_id;
  return v_id;
end;
$$;

-- ============================================================
-- DONE
-- ============================================================
