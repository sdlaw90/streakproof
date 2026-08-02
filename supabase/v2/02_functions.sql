-- ============================================================================
--  Streakproof — functions (run AFTER 01_schema.sql)
--
--  The important one is clone_plan(): it is what replaces v1's "first user to
--  pick a program owns it forever" model. Picking a template copies it into a
--  plan you own, so any number of users can start from the same template.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- Ownership / readability helpers used by the RLS policies in 03_rls.sql.
--
-- security definer + a pinned search_path: these need to see rows the caller
-- can't necessarily select directly, and pinning search_path stops a caller
-- from shadowing `plans` with something of their own.
-- ---------------------------------------------------------------------------

create or replace function public.owns_plan(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plans p
    where p.id = p_id and p.owner_id = auth.uid()
  );
$$;

create or replace function public.can_read_plan(p_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from plans p
    where p.id = p_id
      and (p.owner_id = auth.uid() or p.is_template or p.visibility = 'public')
  );
$$;

create or replace function public.owns_day(d_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from days d join plans p on p.id = d.plan_id
    where d.id = d_id and p.owner_id = auth.uid()
  );
$$;

create or replace function public.can_read_day(d_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from days d join plans p on p.id = d.plan_id
    where d.id = d_id
      and (p.owner_id = auth.uid() or p.is_template or p.visibility = 'public')
  );
$$;

create or replace function public.owns_build(b_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from builds b join plans p on p.id = b.plan_id
    where b.id = b_id and p.owner_id = auth.uid()
  );
$$;

create or replace function public.can_read_build(b_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from builds b join plans p on p.id = b.plan_id
    where b.id = b_id
      and (p.owner_id = auth.uid() or p.is_template or p.visibility = 'public')
  );
$$;

create or replace function public.owns_prep_session(s_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from prep_sessions s join plans p on p.id = s.plan_id
    where s.id = s_id and p.owner_id = auth.uid()
  );
$$;

create or replace function public.can_read_prep_session(s_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from prep_sessions s join plans p on p.id = s.plan_id
    where s.id = s_id
      and (p.owner_id = auth.uid() or p.is_template or p.visibility = 'public')
  );
$$;

-- ---------------------------------------------------------------------------
-- estimate_day_minutes — the "~50 min" label, derived rather than guessed.
--
-- sets x (work + rest), plus a fixed warm-up. Optional exercises are included
-- here; call with p_include_optional = false to get the short-version estimate.
-- ---------------------------------------------------------------------------

create or replace function public.estimate_day_minutes(
  p_day_id uuid,
  p_warmup_minutes int default 6,
  p_include_optional boolean default true
)
returns int language sql stable set search_path = public as $$
  select p_warmup_minutes + coalesce(
    ceil(sum(e.sets * (e.work_seconds + e.rest_seconds)) / 60.0)::int, 0)
  from exercises e
  where e.day_id = p_day_id
    and (p_include_optional or not e.optional);
$$;

-- Recompute and store days.est_minutes for a whole plan (call after edits).
create or replace function public.refresh_plan_estimates(p_plan_id uuid)
returns void language sql volatile set search_path = public as $$
  update days d
     set est_minutes = public.estimate_day_minutes(d.id)
   where d.plan_id = p_plan_id;
$$;

-- ---------------------------------------------------------------------------
-- clone_plan — copy a template (or any readable plan) into a plan you own.
--
-- Runs as the CALLER (security invoker) on purpose: RLS still applies, so this
-- can only read what the user is allowed to read and can only write rows it
-- owns. A security-definer version here would be a privilege-escalation hole.
--
-- Old -> new id mapping is kept in jsonb rather than a temp table so the
-- function has no dependency on search_path containing pg_temp.
-- ---------------------------------------------------------------------------

create or replace function public.clone_plan(
  p_source_id uuid,
  p_name      text default null,
  p_activate  boolean default true
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_uid      uuid := auth.uid();
  v_src      plans%rowtype;
  v_new_id   uuid;
  v_day      record;
  v_new_day  uuid;
  v_item     record;
  v_build    record;
  v_new_build uuid;
  v_prep     record;
  v_new_prep uuid;
  v_item_map jsonb := '{}'::jsonb;   -- old food_item id -> new id
begin
  if v_uid is null then
    raise exception 'clone_plan: not authenticated';
  end if;

  select * into v_src from plans where id = p_source_id;
  if not found then
    raise exception 'clone_plan: plan % not found or not readable', p_source_id;
  end if;

  insert into plans (
    owner_id, is_template, kind, name, description,
    source, template_id, visibility, tracking_mode,
    review_after_weeks, started_on
  )
  values (
    v_uid, false, v_src.kind,
    coalesce(p_name, v_src.name),
    v_src.description,
    case when v_src.is_template then 'template' else v_src.source end,
    case when v_src.is_template then v_src.id else v_src.template_id end,
    'private', v_src.tracking_mode,
    v_src.review_after_weeks, current_date
  )
  returning id into v_new_id;

  if v_src.kind = 'gym' then
    for v_day in select * from days where plan_id = p_source_id order by sort loop
      insert into days (plan_id, key, title, subtitle, sort, est_minutes)
      values (v_new_id, v_day.key, v_day.title, v_day.subtitle, v_day.sort, v_day.est_minutes)
      returning id into v_new_day;

      insert into exercises (day_id, name, scheme, cue, sets, work_seconds, rest_seconds, optional, sort)
      select v_new_day, e.name, e.scheme, e.cue, e.sets, e.work_seconds, e.rest_seconds, e.optional, e.sort
      from exercises e
      where e.day_id = v_day.id;
    end loop;

  else
    -- Food items first: builds and prep tasks both reference them.
    for v_item in select * from food_items where plan_id = p_source_id order by sort loop
      insert into food_items (
        plan_id, name, role, unit, serving_qty,
        kcal, protein_g, carbs_g, fat_g, fiber_g,
        nutrition_source, external_id, batch_cooked, shelf_life_days, sort
      )
      values (
        v_new_id, v_item.name, v_item.role, v_item.unit, v_item.serving_qty,
        v_item.kcal, v_item.protein_g, v_item.carbs_g, v_item.fat_g, v_item.fiber_g,
        v_item.nutrition_source, v_item.external_id, v_item.batch_cooked,
        v_item.shelf_life_days, v_item.sort
      )
      returning id into v_new_day;   -- reusing the uuid variable as scratch

      v_item_map := v_item_map || jsonb_build_object(v_item.id::text, v_new_day::text);
    end loop;

    for v_build in select * from builds where plan_id = p_source_id order by sort loop
      insert into builds (plan_id, key, title, subtitle, is_fallback, est_minutes, sort)
      values (v_new_id, v_build.key, v_build.title, v_build.subtitle,
              v_build.is_fallback, v_build.est_minutes, v_build.sort)
      returning id into v_new_build;

      insert into build_items (build_id, food_item_id, qty, note, sort)
      select v_new_build,
             (v_item_map ->> bi.food_item_id::text)::uuid,
             bi.qty, bi.note, bi.sort
      from build_items bi
      where bi.build_id = v_build.id
        and v_item_map ? bi.food_item_id::text;
    end loop;

    for v_prep in select * from prep_sessions where plan_id = p_source_id order by sort loop
      insert into prep_sessions (plan_id, key, title, weekday, est_minutes, sort)
      values (v_new_id, v_prep.key, v_prep.title, v_prep.weekday, v_prep.est_minutes, v_prep.sort)
      returning id into v_new_prep;

      insert into prep_tasks (prep_session_id, text, food_item_id, sort)
      select v_new_prep, pt.text,
             (v_item_map ->> pt.food_item_id::text)::uuid,
             pt.sort
      from prep_tasks pt
      where pt.prep_session_id = v_prep.id;
    end loop;
  end if;

  if p_activate then
    if v_src.kind = 'gym' then
      update profiles set active_gym_plan_id = v_new_id where id = v_uid;
    else
      update profiles set active_food_plan_id = v_new_id where id = v_uid;
    end if;
  end if;

  return v_new_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- review_due_on — when should we next ask "is this plan still working?"
-- ---------------------------------------------------------------------------

create or replace function public.review_due_on(p_plan_id uuid)
returns date language sql stable set search_path = public as $$
  select coalesce(p.last_reviewed_on, p.started_on, p.created_at::date)
         + (p.review_after_weeks * 7)
  from plans p where p.id = p_plan_id;
$$;
