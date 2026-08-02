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

-- The expected template library, by slug. Asserting the exact set rather than a
-- count means adding a template forces an update here, which is the point: a
-- test that says "6 or more" would never notice one going missing.
do $$
declare
  expected text[] := array[
    'full-body-pool',
    'upper-lower-no-barbell',
    'bodyweight-anywhere',
    'fat-loss-full-body',
    'push-pull-legs-muscle',
    'bowl-rotation-asian-latin'
  ];
  seen text[];
  missing text[];
  extra text[];
begin
  select array_agg(slug order by slug) into seen from plans where is_template;
  select array_agg(x) into missing from unnest(expected) x
   where x <> all(coalesce(seen, array[]::text[]));
  select array_agg(x) into extra from unnest(coalesce(seen, array[]::text[])) x
   where x <> all(expected);

  if missing is not null then
    raise exception 'FAIL: templates missing: %', missing;
  end if;
  if extra is not null then
    raise exception 'FAIL: unexpected templates: %', extra;
  end if;
  raise notice 'PASS: template library is exactly the expected % entries',
    array_length(expected, 1);
end $$;

-- Every gym template must have days and exercises. A template that clones into
-- an empty plan is worse than no template at all.
do $$
declare r record;
begin
  for r in select p.id, p.slug from plans p where p.is_template and p.kind = 'gym' loop
    if (select count(*) from days d where d.plan_id = r.id) < 3 then
      raise exception 'FAIL: template % has fewer than 3 days', r.slug;
    end if;
    if (select count(*) from exercises e
         join days d on d.id = e.day_id where d.plan_id = r.id) < 12 then
      raise exception 'FAIL: template % has too few exercises', r.slug;
    end if;
    if exists (select 1 from days d where d.plan_id = r.id and d.est_minutes is null) then
      raise exception 'FAIL: template % has a day with no duration estimate', r.slug;
    end if;
  end loop;
  raise notice 'PASS: every gym template has days, exercises and estimates';
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

-- ---------------------------------------------------------------------------
-- Account recovery (20260803000001)
-- ---------------------------------------------------------------------------
-- set role matters here: the superuser bypasses RLS, so the "can a user read
-- the hashes" assertion below is meaningless without it.
set role authenticated;
set session "test.uid" = '11111111-1111-1111-1111-111111111111';

do $$
begin
  perform public.set_security_answers(
    array['What was the name of your first pet?',
          'What street did you live on when you were ten?',
          'What was your childhood nickname?'],
    array['  Fluffy ', 'Oak   Lane', 'Sprout']
  );
  raise notice 'PASS: security answers stored';
end $$;

-- The hashes must be unreadable even to their owner. There is no select policy,
-- so this returns zero rows rather than raising.
do $$
declare n int;
begin
  select count(*) into n from security_answers;
  if n <> 0 then
    raise exception 'FAIL: a user could read % security answer rows', n;
  end if;
  raise notice 'PASS: security answers are not readable by anyone';
end $$;

-- Answers must be stored hashed, never in the clear.
reset role;
do $$
declare n int;
begin
  select count(*) into n from security_answers where answer_hash ilike '%fluffy%';
  if n <> 0 then raise exception 'FAIL: an answer was stored in plaintext'; end if;
  select count(*) into n from security_answers where answer_hash like '$2%';
  if n <> 3 then raise exception 'FAIL: expected 3 bcrypt hashes, saw %', n; end if;
  raise notice 'PASS: answers are bcrypt hashed';
end $$;

-- Verification: normalisation must make case and spacing irrelevant, and a
-- wrong answer must fail.
do $$
declare n int;
begin
  select count(*) into n from public.verify_recovery_answers(
    'sean@example.com', array['FLUFFY', 'oak lane', '  sprout  ']);
  if n <> 1 then raise exception 'FAIL: correct answers did not verify (got % rows)', n; end if;
  raise notice 'PASS: answers verify, case- and space-insensitively';

  select count(*) into n from public.verify_recovery_answers(
    'sean@example.com', array['Fluffy', 'oak lane', 'wrong']);
  if n <> 0 then raise exception 'FAIL: a wrong answer still verified'; end if;
  raise notice 'PASS: a wrong answer fails';

  select count(*) into n from public.verify_recovery_answers(
    'nobody@example.com', array['a', 'b', 'c']);
  if n <> 0 then raise exception 'FAIL: unknown email returned rows'; end if;
  raise notice 'PASS: unknown email is indistinguishable from a wrong answer';
end $$;

-- Two-step reset (20260803000004): verification must hand back a single-use,
-- expiring token, and nothing else may be accepted in its place.
do $$
declare
  v_token text;
  v_user  uuid;
  v_second uuid;
begin
  select token into v_token from public.verify_recovery_answers(
    'sean@example.com', array['FLUFFY', 'oak lane', 'sprout']);
  if v_token is null or length(v_token) < 32 then
    raise exception 'FAIL: verification did not mint a usable token (%)', v_token;
  end if;
  raise notice 'PASS: verification mints a token';

  v_user := public.redeem_recovery_token(v_token);
  if v_user is null then raise exception 'FAIL: a fresh token would not redeem'; end if;
  raise notice 'PASS: a fresh token redeems to a user';

  v_second := public.redeem_recovery_token(v_token);
  if v_second is not null then
    raise exception 'FAIL: a token redeemed TWICE — replay is possible';
  end if;
  raise notice 'PASS: a token is single use';

  if public.redeem_recovery_token('not-a-real-token') is not null then
    raise exception 'FAIL: a made-up token redeemed';
  end if;
  raise notice 'PASS: a made-up token is refused';
end $$;

-- Expiry is enforced by the function, not by a cleanup job.
do $$
declare v_user uuid;
begin
  insert into recovery_tokens (token, user_id, expires_at)
  values ('expired-token-for-test',
          '11111111-1111-1111-1111-111111111111',
          now() - interval '1 minute');
  v_user := public.redeem_recovery_token('expired-token-for-test');
  if v_user is not null then
    raise exception 'FAIL: an expired token still redeemed';
  end if;
  raise notice 'PASS: an expired token is refused';
end $$;

-- Minting a new token must invalidate an abandoned earlier one.
do $$
declare v_first text; v_second text;
begin
  select token into v_first from public.verify_recovery_answers(
    'sean@example.com', array['FLUFFY', 'oak lane', 'sprout']);
  select token into v_second from public.verify_recovery_answers(
    'sean@example.com', array['FLUFFY', 'oak lane', 'sprout']);
  if v_first is null or v_second is null then
    raise exception 'FAIL: expected two tokens';
  end if;
  if public.redeem_recovery_token(v_first) is not null then
    raise exception 'FAIL: an abandoned token survived a newer one';
  end if;
  if public.redeem_recovery_token(v_second) is null then
    raise exception 'FAIL: the newest token would not redeem';
  end if;
  raise notice 'PASS: minting a token invalidates the previous one';
end $$;

-- A signed-out client must not be able to read the token table directly.
set role anon;
do $$
declare n int; v_blocked boolean := false;
begin
  begin
    select count(*) into n from recovery_tokens;
    if n > 0 then v_blocked := false; else v_blocked := true; end if;
  exception when others then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'FAIL: anon read % recovery tokens', n;
  end if;
  raise notice 'PASS: recovery tokens are not client-readable';
end $$;
reset role;

-- Rate limit. Counting exact prior attempts here would be brittle — the limit
-- is per email, so the unknown-email probe above doesn't count against this
-- one. Loop instead and assert it trips within a bounded number of tries.
do $$
declare
  n int;
  tries int := 0;
  v_raised boolean := false;
begin
  while tries < 12 and not v_raised loop
    tries := tries + 1;
    begin
      select count(*) into n from public.verify_recovery_answers(
        'sean@example.com', array['FLUFFY', 'oak lane', 'sprout']);
    exception when others then
      v_raised := true;
    end;
  end loop;

  if not v_raised then
    raise exception 'FAIL: rate limit never triggered in % attempts', tries;
  end if;
  if tries > 6 then
    raise exception 'FAIL: rate limit took % attempts, expected 5 an hour', tries;
  end if;
  raise notice 'PASS: recovery is rate limited (tripped on attempt %)', tries;
end $$;

reset role;

-- ---------------------------------------------------------------------------
-- Intake image storage (20260803000003)
-- ---------------------------------------------------------------------------
do $$
declare b record;
begin
  select * into b from storage.buckets where id = 'intake';
  if b is null then raise exception 'FAIL: intake bucket missing'; end if;
  if b.public then
    raise exception 'FAIL: intake bucket is PUBLIC — reference photos would be world-readable';
  end if;
  if b.file_size_limit is null or b.file_size_limit > 10485760 then
    raise exception 'FAIL: intake bucket has no sane size limit (%)', b.file_size_limit;
  end if;
  if b.allowed_mime_types is null then
    raise exception 'FAIL: intake bucket accepts any mime type';
  end if;
  if 'text/html' = any(b.allowed_mime_types) then
    raise exception 'FAIL: intake bucket allows text/html — stored XSS';
  end if;
  raise notice 'PASS: intake bucket is private, size-capped and images-only';
end $$;

set role authenticated;
set session "test.uid" = '11111111-1111-1111-1111-111111111111';

do $$
begin
  insert into storage.objects (bucket_id, name)
  values ('intake', '11111111-1111-1111-1111-111111111111/inspo.jpg');
  raise notice 'PASS: a user can upload into their own folder';
end $$;

-- The whole point of the folder convention: user A must not be able to write
-- into user B's folder, nor read what's in it.
do $$
declare v_blocked boolean := false;
begin
  begin
    insert into storage.objects (bucket_id, name)
    values ('intake', '22222222-2222-2222-2222-222222222222/sneaky.jpg');
  exception when others then
    v_blocked := true;
  end;
  if not v_blocked then
    raise exception 'FAIL: a user wrote into another user''s folder';
  end if;
  raise notice 'PASS: writing into another user''s folder is blocked';
end $$;

set session "test.uid" = '22222222-2222-2222-2222-222222222222';
do $$
declare n int;
begin
  select count(*) into n from storage.objects where bucket_id = 'intake';
  if n <> 0 then
    raise exception 'FAIL: user B can see % of user A''s intake images', n;
  end if;
  raise notice 'PASS: intake images are private per user';
end $$;

reset role;
