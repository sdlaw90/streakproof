-- ============================================================================
--  Streakproof — database schema v2
--  Run FIRST in the Supabase SQL editor, then 02_functions.sql, then seed.sql.
--  Safe to re-run: uses "if not exists" / "or replace" throughout.
--
--  WHAT CHANGED FROM v1 (and why)
--  ------------------------------------------------------------------------
--  1. `programs` -> `plans`. A plan is either a TEMPLATE (owner_id is null,
--     is_template = true) or a user's OWN plan. Picking a template CLONES it
--     (see clone_plan() in 02_functions.sql) instead of claiming ownership,
--     so any number of users can start from the same template and edit freely.
--  2. Plans have a `kind`: 'gym' or 'food'. A user can have one active plan of
--     each kind, so the meal side is not competing with the gym side for the
--     single profiles.program_id slot that v1 had.
--  3. The gym tables (days/exercises/sessions/set_logs) are close to v1.
--     The food side gets its OWN tables rather than being crammed into the
--     exercise shape -- food needs quantities, nutrition, and a many-to-many
--     between reusable pantry items and the builds that use them. Exercises
--     have none of that.
--  4. Calorie counting is an OVERLAY, not a fork: plans.tracking_mode decides
--     which fields the UI shows and what the progress ring measures. Same
--     tables either way.
--  5. `builder_profiles` stores the AI builder's intake as durable data, so it
--     can be reused for regeneration and for the plan-review flow.
--  6. `plan_reviews` drives "should you build a new plan?" prompts.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- ENUM-ish domains (kept as text + check constraints: easier to extend later
-- than real enums, which need ALTER TYPE and can't be changed in a transaction)
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- PLANS — the shared spine for both gym and food
-- ---------------------------------------------------------------------------

create table if not exists plans (
  id          uuid primary key default gen_random_uuid(),

  -- null owner + is_template = a library template anyone can clone.
  owner_id    uuid references auth.users(id) on delete cascade,
  is_template boolean not null default false,

  kind        text not null check (kind in ('gym', 'food')),
  slug        text,                         -- only meaningful for templates
  name        text not null,
  description text,

  -- Where this plan came from. Drives UI copy and lets us measure whether
  -- AI-built plans get adhered to better or worse than templates.
  source      text not null default 'manual'
              check (source in ('template', 'ai', 'manual')),
  template_id uuid references plans(id) on delete set null,

  visibility  text not null default 'private'
              check (visibility in ('private', 'unlisted', 'public')),

  -- Food-only. Ignored for gym plans. 'none' = protein/veg floors only (the
  -- default, and the whole point), 'protein' = track protein, 'full' = macros.
  tracking_mode text not null default 'none'
              check (tracking_mode in ('none', 'protein', 'full')),

  -- Review cycle: when did this block start, how long before we ask whether
  -- it still fits, and when did we last ask.
  started_on         date,
  review_after_weeks int not null default 10 check (review_after_weeks between 1 and 104),
  last_reviewed_on   date,

  archived_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- A template has no owner; a personal plan must have one.
  constraint plans_template_ownership check (
    (is_template and owner_id is null) or (not is_template and owner_id is not null)
  )
);

-- Template slugs are unique; personal plans don't need a slug at all.
create unique index if not exists plans_template_slug_idx
  on plans (slug) where is_template;

create index if not exists plans_owner_idx on plans (owner_id, kind)
  where archived_at is null;

-- ---------------------------------------------------------------------------
-- PROFILES — one active plan per kind (v1 had a single program_id)
-- ---------------------------------------------------------------------------

create table if not exists profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text,
  active_gym_plan_id  uuid references plans(id) on delete set null,
  active_food_plan_id uuid references plans(id) on delete set null,

  -- Local timezone, so "today" is the user's today and not UTC's.
  -- v1 logged everything in UTC, which rolled evening workouts into tomorrow.
  timezone            text not null default 'UTC',

  onboarded_at        timestamptz,
  created_at          timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- BUILDER PROFILES — the AI builder's intake, stored rather than thrown away
--
-- Deliberately jsonb: the intake questions will change often, and every change
-- would otherwise be a migration. The app validates the shape, not Postgres.
-- One row per user per kind.
-- ---------------------------------------------------------------------------

create table if not exists builder_profiles (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('gym', 'food')),
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, kind)
);

-- ---------------------------------------------------------------------------
-- GYM: days -> exercises
-- ---------------------------------------------------------------------------

create table if not exists days (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans(id) on delete cascade,
  key        text not null,               -- 'A', 'B', 'C', 'P'
  title      text not null,
  subtitle   text,
  sort       int  not null default 0,

  -- Cached estimate so lists can show "~50 min" without loading exercises.
  -- Recomputed by the app (or by estimate_day_minutes()) on edit.
  est_minutes int,

  unique (plan_id, key)
);

create table if not exists exercises (
  id      uuid primary key default gen_random_uuid(),
  day_id  uuid not null references days(id) on delete cascade,
  name    text not null,
  scheme  text,                            -- "3 × 6–8 · legs"
  cue     text,
  sets    int  not null default 3 check (sets between 1 and 20),

  -- Duration inputs. v1 had no concept of time at all.
  work_seconds int not null default 45 check (work_seconds between 5 and 600),
  rest_seconds int not null default 90 check (rest_seconds between 0 and 600),

  -- Optional: mark the trimmable work so a "short version" of the day can be
  -- generated for bad days without a second hand-written plan.
  optional boolean not null default false,

  sort    int  not null default 0
  -- NOTE: v1 had unique(day_id, name). Dropped on purpose -- it made supersets
  -- and repeated movements impossible to express.
);

create index if not exists exercises_day_idx on exercises (day_id, sort);

-- ---------------------------------------------------------------------------
-- GYM: logged data
-- ---------------------------------------------------------------------------

create table if not exists sessions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  day_id       uuid not null references days(id) on delete cascade,
  performed_on date not null,              -- supplied by the app in LOCAL time
  notes        text,
  created_at   timestamptz not null default now(),
  unique (user_id, day_id, performed_on)
);

create table if not exists set_logs (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references sessions(id) on delete cascade,
  exercise_id uuid not null references exercises(id) on delete cascade,
  set_number  int  not null check (set_number between 1 and 50),
  weight      numeric,
  reps        int,
  done        boolean not null default false,
  updated_at  timestamptz not null default now(),
  unique (session_id, exercise_id, set_number)
);

create index if not exists set_logs_exercise_idx on set_logs (exercise_id);
create index if not exists sessions_user_idx     on sessions (user_id, performed_on desc);

-- ---------------------------------------------------------------------------
-- FOOD: pantry items -> builds -> components
--
-- A "build" is one assembled meal (Asian bowl, Latin bowl, broth bowl).
-- A "food_item" is a reusable component (chicken, jasmine rice, peanut sauce)
-- that appears in several builds -- hence the join table. Nutrition lives on
-- the item and is entirely optional, which is what makes tracking_mode work.
-- ---------------------------------------------------------------------------

create table if not exists food_items (
  id       uuid primary key default gen_random_uuid(),
  plan_id  uuid not null references plans(id) on delete cascade,
  name     text not null,

  role     text not null default 'extra'
           check (role in ('protein', 'base', 'veg', 'sauce', 'extra')),

  -- Nutrition is per (serving_qty x unit). All nullable: a plan in 'none'
  -- tracking mode never fills these in and never needs to.
  unit        text not null default 'serving',
  serving_qty numeric not null default 1 check (serving_qty > 0),
  kcal        numeric check (kcal >= 0),
  protein_g   numeric check (protein_g >= 0),
  carbs_g     numeric check (carbs_g >= 0),
  fat_g       numeric check (fat_g >= 0),
  fiber_g     numeric check (fiber_g >= 0),

  -- Where the nutrition came from, so we can refresh or attribute it.
  nutrition_source text check (nutrition_source in ('manual', 'usda', 'off', 'ai')),
  external_id      text,

  -- Prep-day flags: is this something you batch on prep day, or grab as-is?
  batch_cooked boolean not null default false,
  shelf_life_days int check (shelf_life_days between 0 and 365),

  sort       int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists food_items_plan_idx on food_items (plan_id, role, sort);

create table if not exists builds (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  key         text not null,               -- 'A', 'B', 'C', 'FALLBACK'
  title       text not null,
  subtitle    text,

  -- The fallback tier: the four-minute meal that still counts. Surfaced
  -- separately in the UI so a bad day has a designed answer.
  is_fallback boolean not null default false,

  est_minutes int,
  sort        int not null default 0,
  unique (plan_id, key)
);

create table if not exists build_items (
  id           uuid primary key default gen_random_uuid(),
  build_id     uuid not null references builds(id) on delete cascade,
  food_item_id uuid not null references food_items(id) on delete cascade,
  qty          numeric not null default 1 check (qty > 0),
  note         text,
  sort         int not null default 0,
  unique (build_id, food_item_id)
);

-- ---------------------------------------------------------------------------
-- FOOD: prep sessions (the Sunday / Wednesday batch-cook checklists)
-- ---------------------------------------------------------------------------

create table if not exists prep_sessions (
  id          uuid primary key default gen_random_uuid(),
  plan_id     uuid not null references plans(id) on delete cascade,
  key         text not null,               -- 'sun', 'wed'
  title       text not null,
  weekday     int check (weekday between 0 and 6),   -- 0 = Sunday
  est_minutes int,
  sort        int not null default 0,
  unique (plan_id, key)
);

create table if not exists prep_tasks (
  id               uuid primary key default gen_random_uuid(),
  prep_session_id  uuid not null references prep_sessions(id) on delete cascade,
  text             text not null,
  food_item_id     uuid references food_items(id) on delete set null,
  sort             int not null default 0
);

-- ---------------------------------------------------------------------------
-- FOOD: logged data
--
-- meal_logs snapshots nutrition at log time so editing a build later doesn't
-- silently rewrite your history.
-- ---------------------------------------------------------------------------

create table if not exists meal_logs (
  id        uuid primary key default gen_random_uuid(),
  user_id   uuid not null references auth.users(id) on delete cascade,
  plan_id   uuid references plans(id) on delete set null,
  build_id  uuid references builds(id) on delete set null,

  -- Free-text meals (the noon breakfast burritos) are first-class, not
  -- failures. build_id is null and name carries it.
  name      text,

  eaten_on  date not null,                 -- LOCAL date, supplied by the app
  eaten_at  timestamptz,
  servings  numeric not null default 1 check (servings > 0),

  -- Snapshot; null when tracking_mode = 'none'.
  kcal      numeric,
  protein_g numeric,
  carbs_g   numeric,
  fat_g     numeric,
  fiber_g   numeric,

  created_at timestamptz not null default now(),

  constraint meal_logs_identified check (build_id is not null or name is not null)
);

create index if not exists meal_logs_user_idx on meal_logs (user_id, eaten_on desc);

create table if not exists prep_logs (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  prep_session_id uuid not null references prep_sessions(id) on delete cascade,
  performed_on    date not null,
  completed_task_ids uuid[] not null default '{}',
  created_at      timestamptz not null default now(),
  unique (user_id, prep_session_id, performed_on)
);

-- ---------------------------------------------------------------------------
-- PLAN REVIEWS — "should you build a new plan?"
--
-- Rows are created by the app (or a cron job) when a trigger fires. Keeping
-- them as data rather than computing on the fly means we can show history
-- ("you've stalled on squats twice") and not re-nag after a dismissal.
-- ---------------------------------------------------------------------------

create table if not exists plan_reviews (
  id         uuid primary key default gen_random_uuid(),
  plan_id    uuid not null references plans(id) on delete cascade,
  user_id    uuid not null references auth.users(id) on delete cascade,

  reason     text not null check (reason in (
               'time',        -- block has run its length
               'stalled',     -- top set flat for N sessions
               'adherence',   -- completing far fewer sessions than planned
               'season',      -- user's sport season changed
               'manual'       -- user asked
             )),
  detail     jsonb not null default '{}'::jsonb,

  due_on     date not null,
  status     text not null default 'pending'
             check (status in ('pending', 'dismissed', 'acted')),

  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- At most one open review per plan per reason, so nagging can't stack up.
create unique index if not exists plan_reviews_open_idx
  on plan_reviews (plan_id, reason) where status = 'pending';

-- ---------------------------------------------------------------------------
-- AI GENERATIONS — audit + cost control
--
-- Every builder call is recorded. This is what makes rate limiting, caching,
-- and "why did it give me this?" debugging possible once the app is public.
-- ---------------------------------------------------------------------------

create table if not exists ai_generations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  plan_id    uuid references plans(id) on delete set null,
  kind       text not null check (kind in ('gym', 'food')),
  mode       text not null check (mode in ('create', 'refine')),

  input      jsonb not null default '{}'::jsonb,   -- intake / refine request
  output     jsonb,                                -- validated plan or diff
  model      text,
  input_tokens  int,
  output_tokens int,

  status     text not null default 'ok'
             check (status in ('ok', 'invalid', 'refused', 'error')),
  error      text,
  created_at timestamptz not null default now()
);

create index if not exists ai_generations_user_idx
  on ai_generations (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Auto-create a profile row on signup
-- ---------------------------------------------------------------------------

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

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------

create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists plans_touch on plans;
create trigger plans_touch before update on plans
  for each row execute function public.touch_updated_at();

drop trigger if exists builder_profiles_touch on builder_profiles;
create trigger builder_profiles_touch before update on builder_profiles
  for each row execute function public.touch_updated_at();
