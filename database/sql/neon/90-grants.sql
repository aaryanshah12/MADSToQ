-- ============================================================
-- Run this LAST, after every table exists.
-- Lets the signed-in app_user role read and write application
-- tables. The table owner (neondb_owner) still bypasses RLS
-- and is what server admin routes use.
-- ============================================================

grant usage on schema public to app_user;
grant usage on schema auth to app_user;
grant execute on function auth.uid() to app_user;

grant select, insert, update, delete on all tables in schema public to app_user;
grant usage, select on all sequences in schema public to app_user;
grant execute on all functions in schema public to app_user;

alter default privileges in schema public
  grant select, insert, update, delete on tables to app_user;
alter default privileges in schema public
  grant usage, select on sequences to app_user;
alter default privileges in schema public
  grant execute on functions to app_user;
