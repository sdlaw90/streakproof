-- ============================================================================
--  LOCAL TEST ONLY — do not run this in Supabase.
--
--  Supabase provides the auth schema, auth.uid(), and the anon/authenticated
--  roles for you. This file fakes just enough of them to run the real schema
--  against a stock Postgres so the SQL can be verified before it touches a
--  live project.
-- ============================================================================

create schema if not exists auth;

create table if not exists auth.users (
  id                  uuid primary key default gen_random_uuid(),
  email               text unique,
  raw_user_meta_data  jsonb default '{}'::jsonb
);

-- Supabase reads the JWT; we read a session GUC we can set from psql.
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('test.uid', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $$;

grant usage on schema public to authenticated, anon;
-- Supabase grants these for real; without them auth.uid() is unreachable
-- from inside a security-invoker function running as `authenticated`.
grant usage on schema auth to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
