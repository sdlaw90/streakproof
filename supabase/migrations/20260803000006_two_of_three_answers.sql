-- ============================================================
--  Recovery: require 2 of 3 answers, not 3 of 3
--
--  Forgetting one of three answers is common, and under a 3-of-3 rule that is a
--  permanently locked account with no support channel. Two of three keeps the
--  scheme usable by the person it exists for.
--
--  Note what this deliberately does NOT do:
--
--   - It does not show only two questions. Showing a random two lets an
--     attacker who knows two answers retry until that pair comes up — roughly a
--     third of attempts, against a limit that resets hourly. All three are
--     always asked; only the passing threshold moved.
--   - It does not report which answers were wrong. Per-question feedback turns
--     three unknowns into three independent one-unknown problems, each
--     brute-forceable on its own. The verdict is still a single yes or no.
--
--  Blank entries are allowed and simply count as wrong, so someone who has
--  genuinely forgotten one can leave it empty rather than inventing something.
--
--  Still interim; deleted with the rest when email lands. See ADR 0012.
-- ============================================================

create or replace function public.verify_recovery_answers(
  p_email   text,
  p_answers text[]
)
returns table (user_id uuid, hint text, token text)
language plpgsql volatile security definer
set search_path = public, extensions, auth as $$
declare
  v_user    uuid;
  v_recent  int;
  v_correct int := 0;
  v_token   text;
  i         int;
  v_count   int;
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
    -- A blank is not an answer; skip it rather than hashing an empty string.
    if coalesce(btrim(p_answers[i]), '') <> '' and exists (
      select 1 from security_answers sa
       where sa.user_id = v_user
         and sa.position = i
         and sa.answer_hash = crypt(
               lower(btrim(regexp_replace(p_answers[i], '\s+', ' ', 'g'))),
               sa.answer_hash)
    ) then
      v_correct := v_correct + 1;
    end if;
  end loop;

  if v_correct < 2 then
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
