-- ============================================================
--  Account recovery — password hint + security questions
--
--  INTERIM. There is no transactional email provider wired up yet, so the
--  normal answer (emailed reset link) isn't available. This exists so a locked-
--  out user has any path back in at all. Security questions are a genuine
--  weakening of account security — see docs/decisions/0012 — and this whole
--  migration is meant to be dropped once email lands.
-- ============================================================

create extension if not exists pgcrypto;

-- --------------------------------------------------------------------------
-- The hint. Deliberately on profiles, not a new table: one per user, nullable,
-- and it is NOT a secret in the cryptographic sense — it is a string the user
-- chose to remind themselves. It is never returned before the security answers
-- are satisfied.
-- --------------------------------------------------------------------------
alter table profiles add column if not exists password_hint text
  check (password_hint is null or length(password_hint) <= 200);

-- --------------------------------------------------------------------------
-- Security answers.
--
-- Answers are stored as bcrypt hashes, never plaintext — the same treatment a
-- password gets, because in this scheme an answer IS a password. The question
-- text is stored in the clear; it has to be shown back to the user.
--
-- Note there is deliberately NO select policy below. Nothing reachable with the
-- anon or authenticated key can read answer_hash, even your own. Verification
-- happens inside a security-definer function that returns a boolean.
-- --------------------------------------------------------------------------
create table if not exists security_answers (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  position    int  not null check (position between 1 and 3),
  question    text not null check (length(question) between 3 and 200),
  answer_hash text not null,
  created_at  timestamptz not null default now(),
  unique (user_id, position)
);

-- --------------------------------------------------------------------------
-- Attempt log. Without this, security questions are an offline-speed brute
-- force against three short answers, which is worse than no recovery at all.
-- Recorded by email rather than user_id because a failed attempt may not
-- correspond to a real account, and we must not leak which is which.
-- --------------------------------------------------------------------------
create table if not exists recovery_attempts (
  id         uuid primary key default gen_random_uuid(),
  email      text not null,
  succeeded  boolean not null default false,
  attempted_at timestamptz not null default now()
);

create index if not exists recovery_attempts_email_idx
  on recovery_attempts (lower(email), attempted_at desc);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
alter table security_answers  enable row level security;
alter table recovery_attempts enable row level security;

-- Write your own answers; read nobody's, including your own. Re-reading them
-- serves no purpose (they're hashed) and a select policy would be one
-- misconfiguration away from leaking the hashes to the client.
drop policy if exists "security answers write" on security_answers;
create policy "security answers write" on security_answers
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "security answers update" on security_answers;
create policy "security answers update" on security_answers
  for update to authenticated using (user_id = auth.uid());

drop policy if exists "security answers delete" on security_answers;
create policy "security answers delete" on security_answers
  for delete to authenticated using (user_id = auth.uid());

-- recovery_attempts gets no policy at all: service role only.

-- --------------------------------------------------------------------------
-- Does this user have recovery set up? Answerable without exposing anything.
-- --------------------------------------------------------------------------
create or replace function public.has_security_questions()
returns boolean language sql stable security invoker set search_path = public as $$
  select exists (select 1 from security_answers where user_id = auth.uid());
$$;

-- --------------------------------------------------------------------------
-- Store the three answers, hashed. Runs as the caller, so RLS still applies —
-- this is a convenience wrapper around the hashing, not a privilege escalation.
-- --------------------------------------------------------------------------
create or replace function public.set_security_answers(
  p_questions text[],
  p_answers   text[]
)
returns void language plpgsql volatile security invoker set search_path = public as $$
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
      -- bf = bcrypt. The cost is deliberate: these answers are lower entropy
      -- than a password, so the hash has to be slower to compensate.
      crypt(lower(btrim(regexp_replace(p_answers[i], '\s+', ' ', 'g'))), gen_salt('bf', 10))
    );
  end loop;
end $$;

-- --------------------------------------------------------------------------
-- The questions to show someone who is locked out.
--
-- SECURITY DEFINER because the caller is signed OUT by definition. Returns
-- question text only, never hashes. Returns an empty set for an unknown email,
-- which is the same shape as "this user never set questions up" — the caller
-- cannot tell the two apart, so this is not an account-existence oracle.
-- --------------------------------------------------------------------------
create or replace function public.recovery_questions_for(p_email text)
-- "position" is quoted because it is a reserved word in a RETURNS
-- TABLE column list (it collides with the position() function).
returns table ("position" int, question text)
language sql stable security definer set search_path = public, auth as $$
  select sa.position, sa.question
    from security_answers sa
    join auth.users u on u.id = sa.user_id
   where lower(u.email) = lower(btrim(p_email))
   order by sa.position;
$$;

revoke all on function public.recovery_questions_for(text) from public;
grant execute on function public.recovery_questions_for(text) to anon, authenticated;

-- --------------------------------------------------------------------------
-- Check three answers and, if they all match, return the user id and hint.
--
-- Rate limited to 5 attempts per email per hour, counted before the comparison
-- so a lockout can't be avoided by racing. Every call is logged.
-- --------------------------------------------------------------------------
create or replace function public.verify_recovery_answers(
  p_email   text,
  p_answers text[]
)
returns table (user_id uuid, hint text)
language plpgsql volatile security definer set search_path = public, auth as $$
declare
  v_user   uuid;
  v_recent int;
  v_ok     boolean := true;
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

  return query
    select v_user, p.password_hint from profiles p where p.id = v_user;
end $$;

revoke all on function public.verify_recovery_answers(text, text[]) from public;
grant execute on function public.verify_recovery_answers(text, text[]) to anon, authenticated;
