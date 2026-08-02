-- ============================================================================
--  Streakproof — row level security (run AFTER 02_functions.sql)
--
--  Shape of the rules:
--    * Templates (owner_id null, is_template) are readable by every signed-in
--      user and writable by nobody through the API. Only the service role
--      (i.e. seed.sql) creates them.
--    * A personal plan and everything hanging off it is readable and writable
--      only by its owner.
--    * Logged data (sessions, sets, meals, prep, reviews, AI calls) is private
--      to the user who created it, always.
-- ============================================================================

alter table plans            enable row level security;
alter table profiles         enable row level security;
alter table builder_profiles enable row level security;
alter table days             enable row level security;
alter table exercises        enable row level security;
alter table sessions         enable row level security;
alter table set_logs         enable row level security;
alter table food_items       enable row level security;
alter table builds           enable row level security;
alter table build_items      enable row level security;
alter table prep_sessions    enable row level security;
alter table prep_tasks       enable row level security;
alter table meal_logs        enable row level security;
alter table prep_logs        enable row level security;
alter table plan_reviews     enable row level security;
alter table ai_generations   enable row level security;

-- ---------------------------------------------------------------------------
-- PLANS
-- ---------------------------------------------------------------------------

drop policy if exists "plans read"   on plans;
drop policy if exists "plans insert" on plans;
drop policy if exists "plans update" on plans;
drop policy if exists "plans delete" on plans;

create policy "plans read" on plans for select to authenticated
  using (owner_id = auth.uid() or is_template or visibility = 'public');

-- `not is_template` matters: without it a user could mint a plan that every
-- other user can then read and clone.
create policy "plans insert" on plans for insert to authenticated
  with check (owner_id = auth.uid() and not is_template);

create policy "plans update" on plans for update to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid() and not is_template);

create policy "plans delete" on plans for delete to authenticated
  using (owner_id = auth.uid());

-- ---------------------------------------------------------------------------
-- PROFILES / BUILDER PROFILES — self only
-- ---------------------------------------------------------------------------

drop policy if exists "profiles self"        on profiles;
drop policy if exists "profiles self insert" on profiles;

create policy "profiles self" on profiles for all to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists "builder profiles self" on builder_profiles;
create policy "builder profiles self" on builder_profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- GYM reference data
-- ---------------------------------------------------------------------------

drop policy if exists "days read"  on days;
drop policy if exists "days write" on days;
create policy "days read"  on days for select to authenticated
  using (public.can_read_plan(plan_id));
create policy "days write" on days for all to authenticated
  using (public.owns_plan(plan_id)) with check (public.owns_plan(plan_id));

drop policy if exists "exercises read"  on exercises;
drop policy if exists "exercises write" on exercises;
create policy "exercises read"  on exercises for select to authenticated
  using (public.can_read_day(day_id));
create policy "exercises write" on exercises for all to authenticated
  using (public.owns_day(day_id)) with check (public.owns_day(day_id));

-- ---------------------------------------------------------------------------
-- FOOD reference data
-- ---------------------------------------------------------------------------

drop policy if exists "food items read"  on food_items;
drop policy if exists "food items write" on food_items;
create policy "food items read"  on food_items for select to authenticated
  using (public.can_read_plan(plan_id));
create policy "food items write" on food_items for all to authenticated
  using (public.owns_plan(plan_id)) with check (public.owns_plan(plan_id));

drop policy if exists "builds read"  on builds;
drop policy if exists "builds write" on builds;
create policy "builds read"  on builds for select to authenticated
  using (public.can_read_plan(plan_id));
create policy "builds write" on builds for all to authenticated
  using (public.owns_plan(plan_id)) with check (public.owns_plan(plan_id));

drop policy if exists "build items read"  on build_items;
drop policy if exists "build items write" on build_items;
create policy "build items read"  on build_items for select to authenticated
  using (public.can_read_build(build_id));
create policy "build items write" on build_items for all to authenticated
  using (public.owns_build(build_id)) with check (public.owns_build(build_id));

drop policy if exists "prep sessions read"  on prep_sessions;
drop policy if exists "prep sessions write" on prep_sessions;
create policy "prep sessions read"  on prep_sessions for select to authenticated
  using (public.can_read_plan(plan_id));
create policy "prep sessions write" on prep_sessions for all to authenticated
  using (public.owns_plan(plan_id)) with check (public.owns_plan(plan_id));

drop policy if exists "prep tasks read"  on prep_tasks;
drop policy if exists "prep tasks write" on prep_tasks;
create policy "prep tasks read"  on prep_tasks for select to authenticated
  using (public.can_read_prep_session(prep_session_id));
create policy "prep tasks write" on prep_tasks for all to authenticated
  using (public.owns_prep_session(prep_session_id))
  with check (public.owns_prep_session(prep_session_id));

-- ---------------------------------------------------------------------------
-- Logged data — private per user
-- ---------------------------------------------------------------------------

drop policy if exists "own sessions" on sessions;
create policy "own sessions" on sessions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own sets" on set_logs;
create policy "own sets" on set_logs for all to authenticated
  using (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()));

drop policy if exists "own meal logs" on meal_logs;
create policy "own meal logs" on meal_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own prep logs" on prep_logs;
create policy "own prep logs" on prep_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own plan reviews" on plan_reviews;
create policy "own plan reviews" on plan_reviews for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- AI generations: readable by the user, but only writable server-side (the
-- service role bypasses RLS). No insert/update policy on purpose -- a client
-- must not be able to forge token counts or fabricate generation history.
drop policy if exists "own ai generations" on ai_generations;
create policy "own ai generations" on ai_generations for select to authenticated
  using (user_id = auth.uid());
