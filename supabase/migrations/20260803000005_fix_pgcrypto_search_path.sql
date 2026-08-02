-- ============================================================
--  Fix: pgcrypto lives in `extensions` on Supabase, not `public`
--
--  `set search_path = public` on the recovery functions meant crypt(),
--  gen_salt() and gen_random_bytes() were unresolvable in production:
--
--      function gen_salt(unknown, integer) does not exist
--
--  `create extension if not exists pgcrypto` in 20260803000001 did nothing,
--  because Supabase already ships it — installed into the `extensions` schema.
--  The local harness created it in `public`, so every assertion passed against
--  a layout production doesn't have. The stub has been corrected to match; see
--  supabase/tools/test/00_supabase_stub.sql.
--
--  Adding `extensions` to the search path rather than schema-qualifying each
--  call: a missing schema in search_path is ignored, so this stays correct on a
--  stock Postgres where pgcrypto is in public.
-- ============================================================

create or replace function public.set_security_answers(
  p_questions text[],
  p_answers   text[]
)
returns void language plpgsql volatile security invoker
set search_path = public, extensions as $$
declare
  i int;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if array_length(p_questions, 1) is distinct from 3
     or array_length(p_answers, 1) is distinct from 3 then
    raise exception 'expected exactly 3 questions and 3 answers';
  end if;

  delete from security_answers where user_id = auth.uid();

  for i in 1..3 loop
    if length(btrim(p_answers[i])) < 2 then
      raise exception 'answer % is too short', i;
    end if;
    insert into security_answers (user_id, position, question, answer_hash)
    values (
      auth.uid(),
      i,
      p_questions[i],
      crypt(lower(btrim(regexp_replace(p_answers[i], '\s+', ' ', 'g'))), gen_salt('bf', 10))
    );
  end loop;
end $$;

create or replace function public.verify_recovery_answers(
  p_email   text,
  p_answers text[]
)
returns table (user_id uuid, hint text, token text)
language plpgsql volatile security definer
set search_path = public, extensions, auth as $$
declare
  v_user   uuid;
  v_recent int;
  v_ok     boolean := true;
  v_token  text;
  i        int;
  v_count  int;
begin
  select count(*) into v_recent
    from recovery_attempts ra
   where lower(ra.email) = lower(btrim(p_email))
     and ra.attempted_at > now() - interval '1 hour';

  if v_recent >= 5 then
    raise exception 'too many attempts — wait an hour';
  end if;

  insert into recovery_attempts (email) values (btrim(p_email));

  select u.id into v_user from auth.users u
   where lower(u.email) = lower(btrim(p_email));

  if v_user is null then
    return;
  end if;

  select count(*) into v_count from security_answers sa where sa.user_id = v_user;
  if v_count <> 3 then
    return;
  end if;
  if array_length(p_answers, 1) is distinct from 3 then
    return;
  end if;

  for i in 1..3 loop
    if not exists (
      select 1 from security_answers sa
       where sa.user_id = v_user
         and sa.position = i
         and sa.answer_hash = crypt(
               lower(btrim(regexp_replace(p_answers[i], '\s+', ' ', 'g'))),
               sa.answer_hash)
    ) then
      v_ok := false;
    end if;
  end loop;

  if not v_ok then
    return;
  end if;

  update recovery_attempts ra set succeeded = true
   where ra.id = (select id from recovery_attempts
                   where lower(email) = lower(btrim(p_email))
                   order by attempted_at desc limit 1);

  v_token := encode(gen_random_bytes(32), 'hex');

  update recovery_tokens set used_at = now()
   where recovery_tokens.user_id = v_user and used_at is null;

  insert into recovery_tokens (token, user_id, expires_at)
  values (v_token, v_user, now() + interval '10 minutes');

  return query
    select v_user, p.password_hint, v_token from profiles p where p.id = v_user;
end $$;

revoke all on function public.verify_recovery_answers(text, text[]) from public;
grant execute on function public.verify_recovery_answers(text, text[]) to anon, authenticated;
