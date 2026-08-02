-- ============================================================================
--  Let signed-out visitors read the template library.
--
--  The v2 policies were all `to authenticated`, which meant a signed-out client
--  saw zero plans — correct for user data, but it also hid the curated
--  templates, which contain nothing private and are the most useful thing to
--  show someone who hasn't signed up yet ("here's what you'd get").
--
--  Scope is deliberately narrow: templates and explicitly-public plans only.
--  A user's own plans stay invisible to anon, as does every logged row.
-- ============================================================================

drop policy if exists "anon reads templates" on plans;
create policy "anon reads templates" on plans for select to anon
  using (is_template or visibility = 'public');

-- The children of a readable plan need the same treatment, or a landing page
-- could list template names but nothing inside them.
drop policy if exists "anon reads template days" on days;
create policy "anon reads template days" on days for select to anon
  using (exists (
    select 1 from plans p
    where p.id = days.plan_id and (p.is_template or p.visibility = 'public')
  ));

drop policy if exists "anon reads template exercises" on exercises;
create policy "anon reads template exercises" on exercises for select to anon
  using (exists (
    select 1 from days d join plans p on p.id = d.plan_id
    where d.id = exercises.day_id and (p.is_template or p.visibility = 'public')
  ));

drop policy if exists "anon reads template builds" on builds;
create policy "anon reads template builds" on builds for select to anon
  using (exists (
    select 1 from plans p
    where p.id = builds.plan_id and (p.is_template or p.visibility = 'public')
  ));

drop policy if exists "anon reads template food items" on food_items;
create policy "anon reads template food items" on food_items for select to anon
  using (exists (
    select 1 from plans p
    where p.id = food_items.plan_id and (p.is_template or p.visibility = 'public')
  ));

-- Note: no anon policy on build_items, prep_sessions, prep_tasks, sessions,
-- set_logs, meal_logs, prep_logs, profiles, builder_profiles, plan_reviews or
-- ai_generations. Signed-out visitors get the shop window, nothing else.
