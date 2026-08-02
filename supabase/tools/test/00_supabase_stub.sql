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

-- ---------------------------------------------------------------------------
-- Storage.
--
-- Enough of Supabase Storage to check the bucket config and the per-user folder
-- policies in 20260803000003. Only the columns and the one function the
-- migration and its assertions actually touch — this is not an attempt to
-- reimplement storage, and anything relying on behaviour beyond `name` splitting
-- would be testing the stub rather than the schema.
-- ---------------------------------------------------------------------------
create schema if not exists storage;

create table if not exists storage.buckets (
  id                 text primary key,
  name               text not null,
  public             boolean not null default false,
  file_size_limit    bigint,
  allowed_mime_types text[]
);

create table if not exists storage.objects (
  id        uuid primary key default gen_random_uuid(),
  bucket_id text not null references storage.buckets(id),
  name      text not null,
  owner     uuid
);

alter table storage.objects enable row level security;

-- Supabase's real implementation; the path is split on "/" and the last
-- segment (the filename) is dropped.
create or replace function storage.foldername(name text)
returns text[] language sql immutable as $$
  select (string_to_array(name, '/'))[1:array_length(string_to_array(name, '/'), 1) - 1];
$$;

grant usage on schema public to authenticated, anon;
-- Supabase grants these for real; without them auth.uid() is unreachable
-- from inside a security-invoker function running as `authenticated`.
grant usage on schema auth to authenticated, anon;
grant usage on schema storage to authenticated, anon;
grant execute on function auth.uid() to authenticated, anon;
grant execute on function storage.foldername(text) to authenticated, anon;
grant select, insert, update, delete on storage.objects to authenticated;
grant select on storage.buckets to authenticated, anon;
alter default privileges in schema public
  grant select, insert, update, delete on tables to authenticated;
