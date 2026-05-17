-- ============================================================
-- Grant PMC Portal access to an EXISTING Supabase Auth user
--
-- Use when the person already signs in to other portals (Inventory,
-- Sales, etc.) with the same email/password. This only adds the
-- pmc_users allowlist row — it does NOT create or change Auth.
--
-- Run in Supabase SQL Editor after pmc-schema.sql
-- ============================================================

insert into public.pmc_users (user_id, full_name, email, is_active)
select
  id,
  'Factory Owner',
  email,
  true
from auth.users
where lower(email) = lower('owner@factory.com')
on conflict (user_id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    is_active = true;

-- Verify (should return 1 row):
-- select * from public.pmc_users where lower(email) = lower('owner@factory.com');

-- If the insert affects 0 rows, the email is not in Authentication → Users yet.
