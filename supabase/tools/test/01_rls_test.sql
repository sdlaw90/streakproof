-- ============================================================================
--  LOCAL TEST ONLY. Verifies the things v2 is supposed to fix.
--  Run after the stub + all four migrations. Any failure raises and aborts.
-- ============================================================================

\set ON_ERROR_STOP on

-- Two users. The signup trigger should create their profiles.
insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'sean@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'ely@example.com')
on conflict do nothing;

do $$
begin
  if (select count(*) from profiles) <> 2 then
    raise exception 'FAIL: signup trigger did not create both profiles';
  end if;
  raise notice 'PASS: profiles auto-created on signup';
end $$;

-- ---------------------------------------------------------------------------
-- User A
-- ---------------------------------------------------------------------------
set role authenticated;
set session "test.uid" = '11111111-1111-1111-1111-111111111111';

do $$
declare n int;
begin
  select count(*) into n from plans where is_template;
  if n <> 3 then raise exception 'FAIL: expected 3 templates, saw %', n; end if;
  raise notice 'PASS: templates readable (%)', n;
end $$;

-- A template must not be editable by a user.
do $$
begin
  begin
    update plans set name = 'hijacked' where is_template;
    if found then raise exception 'FAIL: a user was able to edit a template'; end if;
  exception when insufficient_privilege then
    null;
  end;
  raise notice 'PASS: templates are not user-editable';
end $$;

-- Clone the gym template.
do $$
declare v_plan uuid; n_days int; n_ex int; v_est int;
begin
  select public.clone_plan(id) into v_plan
    from plans where slug = 'full-body-pool' and is_template;

  select count(*) into n_days from days where plan_id = v_plan;
  select count(*) into n_ex   from exercises e join days d on d.id = e.day_id
    where d.plan_id = v_plan;
  if n_days <> 4 then raise exception 'FAIL: expected 4 days, got %', n_days; end if;
  if n_ex < 20 then raise exception 'FAIL: exercises did not copy (got %)', n_ex; end if;

  select est_minutes into v_est from days where plan_id = v_plan and key = 'A';
  if v_est is null or v_est < 20 then
    raise exception 'FAIL: est_minutes not computed (got %)', v_est;
  end if;

  if not exists (select 1 from profiles
                 where id = auth.uid() and active_gym_plan_id = v_plan) then
    raise exception 'FAIL: clone did not activate the plan';
  end if;

  raise notice 'PASS: gym clone — % days, % exercises, Day A ~% min', n_days, n_ex, v_est;
end $$;

-- Clone the food template and check the many-to-many remapping.
do $$
declare v_plan uuid; n_items int; n_builds int; n_bi int; n_tasks int; n_orphan int;
begin
  select public.clone_plan(id) into v_plan
    from plans where slug = 'bowl-rotation-asian-latin' and is_template;

  select count(*) into n_items  from food_items where plan_id = v_plan;
  select count(*) into n_builds from builds     where plan_id = v_plan;
  select count(*) into n_bi from build_items bi
    join builds b on b.id = bi.build_id where b.plan_id = v_plan;
  select count(*) into n_tasks from prep_tasks pt
    join prep_sessions ps on ps.id = pt.prep_session_id where ps.plan_id = v_plan;

  if n_items < 20 then raise exception 'FAIL: food items did not copy (%)', n_items; end if;
  if n_builds <> 6 then raise exception 'FAIL: expected 6 builds, got %', n_builds; end if;
  if n_bi < 20 then raise exception 'FAIL: build components did not copy (%)', n_bi; end if;

  -- The real risk in the clone: build_items still pointing at the TEMPLATE's
  -- food_items instead of the copies.
  select count(*) into n_orphan
  from build_items bi
  join builds b on b.id = bi.build_id
  join food_items fi on fi.id = bi.food_item_id
  where b.plan_id = v_plan and fi.plan_id <> v_plan;
  if n_orphan > 0 then
    raise exception 'FAIL: % build_items still point at the template''s items', n_orphan;
  end if;

  if not exists (select 1 from builds where plan_id = v_plan and is_fallback) then
    raise exception 'FAIL: fallback build missing';
  end if;

  raise notice 'PASS: food clone — % items, % builds, % components, % prep tasks, 0 orphans',
    n_items, n_builds, n_bi, n_tasks;
end $$;

-- ---------------------------------------------------------------------------
-- User B — the case v1 could not handle at all
-- ---------------------------------------------------------------------------
set session "test.uid" = '22222222-2222-2222-2222-222222222222';

do $$
declare v_plan uuid; n int;
begin
  select public.clone_plan(id) into v_plan
    from plans where slug = 'full-body-pool' and is_template;
  select count(*) into n from days where plan_id = v_plan;
  if n <> 4 then raise exception 'FAIL: second user could not clone the same template'; end if;
  raise notice 'PASS: two users cloned the same template (v1 could not)';
end $$;

do $$
declare n int;
begin
  select count(*) into n from plans
   where owner_id = '11111111-1111-1111-1111-111111111111';
  if n <> 0 then raise exception 'FAIL: user B can see % of user A''s plans', n; end if;
  raise notice 'PASS: user B cannot see user A''s plans';
end $$;

do $$
declare n int;
begin
  select count(*) into n from days d join plans p on p.id = d.plan_id
   where p.owner_id = '11111111-1111-1111-1111-111111111111';
  if n <> 0 then raise exception 'FAIL: user B can read % of user A''s days', n; end if;
  raise notice 'PASS: user B cannot read user A''s plan contents';
end $$;

-- A user must not be able to mint a template for everyone else.
do $$
begin
  begin
    insert into plans (owner_id, is_template, kind, name)
    values (auth.uid(), true, 'gym', 'sneaky template');
    raise exception 'FAIL: user was able to create a template';
  exception
    when insufficient_privilege then raise notice 'PASS: users cannot create templates';
    when check_violation      then raise notice 'PASS: users cannot create templates';
  end;
end $$;

-- Logged data stays private.
do $$
declare v_day uuid; v_sess uuid;
begin
  select d.id into v_day from days d join plans p on p.id = d.plan_id
   where p.owner_id = auth.uid() limit 1;
  insert into sessions (user_id, day_id, performed_on)
  values (auth.uid(), v_day, current_date) returning id into v_sess;
  raise notice 'PASS: user B logged a session';
end $$;

set session "test.uid" = '11111111-1111-1111-1111-111111111111';
do $$
declare n int;
begin
  select count(*) into n from sessions
   where user_id = '22222222-2222-2222-2222-222222222222';
  if n <> 0 then raise exception 'FAIL: user A can see user B''s sessions'; end if;
  raise notice 'PASS: sessions are private per user';
end $$;

reset role;
