-- ============================================================
--  Recovery tokens — splitting "prove who you are" from "choose a password"
--
--  The first version of this flow asked for the answers and the new password on
--  one form. That means you only discover the answers were wrong after typing a
--  password, which is exactly the wrong order for someone already locked out.
--
--  Splitting it into two requests means the server has to remember that the
--  answers were verified. That memory is this table: a single-use, short-lived,
--  unguessable token. The alternative — trusting the client to say "I already
--  passed" — is not an alternative.
--
--  Still interim, and still deleted with the rest when email lands.
--  See docs/decisions/0012.
-- ============================================================

create table if not exists recovery_tokens (
  token      text primary key,
  user_id    uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at    timestamptz
);

create index if not exists recovery_tokens_user_idx
  on recovery_tokens (user_id, created_at desc);

-- No policies at all: this table is reachable only from the security-definer
-- functions below. A client that could read it could reset any account whose
-- questions someone else had just answered.
alter table recovery_tokens enable row level security;

-- --------------------------------------------------------------------------
-- verify_recovery_answers now mints a token on success.
--
-- Dropped and recreated rather than replaced: the return type changes, and
-- `create or replace function` cannot do that.
-- --------------------------------------------------------------------------
drop function if exists public.verify_recovery_answers(text, text[]);

create or replace function public.verify_recovery_answers(
  p_email   text,
  p_answers text[]
)
returns table (user_id uuid, hint text, token text)
language plpgsql volatile security definer set search_path = public, auth as $$
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
    return; -- unknown email: no rows, same as a wrong answer
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

  -- 256 bits from pgcrypto's CSPRNG. Ten minutes is long enough to choose a
  -- password and short enough that a leaked token is worthless by the time
  -- anyone finds it.
  v_token := encode(gen_random_bytes(32), 'hex');

  -- One live token per user: minting a new one kills any earlier ones, so an
  -- abandoned attempt can't be picked up later.
  update recovery_tokens set used_at = now()
   where recovery_tokens.user_id = v_user and used_at is null;

  insert into recovery_tokens (token, user_id, expires_at)
  values (v_token, v_user, now() + interval '10 minutes');

  return query
    select v_user, p.password_hint, v_token from profiles p where p.id = v_user;
end $$;

revoke all on function public.verify_recovery_answers(text, text[]) from public;
grant execute on function public.verify_recovery_answers(text, text[]) to anon, authenticated;

-- --------------------------------------------------------------------------
-- Redeem a token. Single use, enforced here rather than in the app.
--
-- Marks the token used in the same statement that reads it, so two concurrent
-- requests can't both win: the UPDATE takes a row lock and the loser sees
-- used_at already set.
-- --------------------------------------------------------------------------
create or replace function public.redeem_recovery_token(p_token text)
returns uuid
language plpgsql volatile security definer set search_path = public, auth as $$
declare
  v_user uuid;
begin
  update recovery_tokens
     set used_at = now()
   where token = p_token
     and used_at is null
     and expires_at > now()
  returning recovery_tokens.user_id into v_user;

  return v_user; -- null when unknown, already used, or expired
end $$;

revoke all on function public.redeem_recovery_token(text) from public;
grant execute on function public.redeem_recovery_token(text) to anon, authenticated;
