-- ============================================================================
--  Gym Tracker — database schema (v2, structured set logging)
--  Run this FIRST in the Supabase SQL editor (Dashboard -> SQL Editor -> New query).
--  Then run seed.sql to load the workout programs.
--  Safe to re-run: it uses "if not exists" / "or replace" throughout.
-- ============================================================================

-- ---------- Reference data (a program is owned & editable by one user) -------

create table if not exists programs (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  name       text not null,
  owner_id   uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

create table if not exists days (
  id         uuid primary key default gen_random_uuid(),
  program_id uuid not null references programs(id) on delete cascade,
  key        text not null,
  title      text not null,
  subtitle   text,
  sort       int  not null default 0,
  unique (program_id, key)
);

create table if not exists exercises (
  id      uuid primary key default gen_random_uuid(),
  day_id  uuid not null references days(id) on delete cascade,
  name    text not null,
  scheme  text,
  cue     text,
  sets    int  not null default 3,
  sort    int  not null default 0,
  unique (day_id, name)
);

-- ---------- Per-user data ----------------------------------------------------

create table if not exists profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  program_id   uuid references programs(id),
  created_at   timestamptz default now()
);

create table if not exists sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  day_id       uuid not null references days(id) on delete cascade,
  performed_on date not null default current_date,
  created_at   timestamptz default now(),
  unique (user_id, day_id, performed_on)
);

-- One row per set actually logged.
create table if not exists set_logs (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  set_number  int  not null,
  weight      numeric,
  reps        int,
  done        boolean not null default false,
  updated_at  timestamptz default now(),
  unique (session_id, exercise_id, set_number)
);

create index if not exists set_logs_exercise_idx on set_logs (exercise_id);
create index if not exists sessions_user_idx on sessions (user_id);

-- ---------- Auto-create a profile row when a user signs up -------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------- Row Level Security ----------------------------------------------

alter table programs      enable row level security;
alter table days          enable row level security;
alter table exercises     enable row level security;
alter table profiles      enable row level security;
alter table sessions      enable row level security;
alter table set_logs      enable row level security;

-- Programs: everyone signed-in can read. A user may CLAIM an unowned program
-- (setting themselves as owner) and thereafter edit only their own.
drop policy if exists "read programs"   on programs;
drop policy if exists "insert programs" on programs;
drop policy if exists "update programs" on programs;
drop policy if exists "delete programs" on programs;
create policy "read programs"   on programs for select to authenticated using (true);
create policy "insert programs" on programs for insert to authenticated with check (owner_id = auth.uid());
create policy "update programs" on programs for update to authenticated
  using (owner_id is null or owner_id = auth.uid())
  with check (owner_id = auth.uid());
create policy "delete programs" on programs for delete to authenticated using (owner_id = auth.uid());

-- Helper: is the current user the owner of the program this day/exercise belongs to?
create or replace function public.owns_program(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from programs p where p.id = p_id and p.owner_id = auth.uid());
$$;

create or replace function public.owns_day(d_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from days d join programs p on p.id = d.program_id
    where d.id = d_id and p.owner_id = auth.uid()
  );
$$;

-- Days: read all; write only within a program you own.
drop policy if exists "read days"   on days;
drop policy if exists "write days"  on days;
create policy "read days"  on days for select to authenticated using (true);
create policy "write days" on days for all to authenticated
  using (public.owns_program(program_id))
  with check (public.owns_program(program_id));

-- Exercises: read all; write only within a day whose program you own.
drop policy if exists "read exercises"  on exercises;
drop policy if exists "write exercises" on exercises;
create policy "read exercises"  on exercises for select to authenticated using (true);
create policy "write exercises" on exercises for all to authenticated
  using (public.owns_day(day_id))
  with check (public.owns_day(day_id));

-- Profiles: a user only sees / edits their own row.
drop policy if exists "own profile select" on profiles;
drop policy if exists "own profile insert" on profiles;
drop policy if exists "own profile update" on profiles;
create policy "own profile select" on profiles for select to authenticated using (auth.uid() = id);
create policy "own profile insert" on profiles for insert to authenticated with check (auth.uid() = id);
create policy "own profile update" on profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

-- Sessions: a user fully manages their own.
drop policy if exists "own sessions" on sessions;
create policy "own sessions" on sessions for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Set logs: reachable only through the user's own sessions.
drop policy if exists "own sets" on set_logs;
create policy "own sets" on set_logs for all to authenticated
  using (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()));
