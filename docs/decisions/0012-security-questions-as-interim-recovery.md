# 0012 — Security questions as interim password recovery

- **Status:** Accepted, with an explicit expiry — see "Removal" below
- **Date:** 2026-08-02

## Context

There is no transactional email provider wired up, so the normal answer to a
forgotten password — an emailed reset link — isn't available. Without something,
a user who forgets their password has no path back into their account at all,
and no support channel to ask.

Security questions are a known weakening of account security, and that isn't in
dispute here. Answers are low entropy, frequently discoverable (a first pet's
name is often on a public profile), reused across sites, and they sit *beside*
the password as a second, weaker way in. Recommending them would be wrong. The
alternative on the table was "no recovery at all", which for a real user with
real logged sessions is also wrong.

## Decision

Ship security questions plus an optional password hint, as an explicitly
temporary measure, with the weaknesses mitigated rather than ignored:

- **Answers are bcrypt hashed** (`pgcrypto`, cost 10) exactly as a password
  would be. In this scheme an answer *is* a password, so it gets the same
  treatment. Nothing stores plaintext.
- **`security_answers` has no select policy at all.** Not even the owner can
  read their own hashes through the API. Verification happens inside a
  `security definer` function that returns a boolean-shaped result.
- **Rate limited to 5 attempts per email per hour**, enforced in Postgres before
  the comparison and logged to `recovery_attempts`. Without this the scheme is
  an offline-speed brute force against three short strings, which is worse than
  no recovery.
- **No account-existence oracle.** "Wrong answers", "no questions set up" and
  "no such account" are indistinguishable to the caller — same empty result,
  same message.
- **Curated question list**, not free text, chosen so answers don't change over
  time and aren't in public records. Mother's maiden name is deliberately
  absent.
- **Answers are normalised** (trimmed, lowercased, inner whitespace collapsed)
  before hashing and comparison. Someone locked out by a capital letter is a
  support problem with no support channel.
- **Entirely optional and skippable.** The opt-in appears once after signup and
  can be skipped; it's reachable later from the account drawer.
- **The hint is never shown before the answers are satisfied.** A hint on the
  login screen leaks to anyone who can type an email address. Once they *are*
  satisfied the hint is shown alongside the password form, with a "remembered
  it? sign in instead" link — quite often the hint is all someone needed, and
  not changing the password is the better outcome.
- **Two steps, joined by a single-use token.** Answers are checked first and,
  on success, Postgres mints a 256-bit token valid for ten minutes; the password
  form spends it. Asking for answers and a new password on one form means the
  user only learns the answers were wrong *after* choosing a password, which is
  the wrong order for someone already locked out. The token is burned in the
  same statement that reads it, so a replay loses the race, and minting a new
  one invalidates any abandoned earlier token.

## Consequences

- One privileged code path now exists: `resetWithAnswers` uses the service-role
  key to set a password for a signed-out user. It is the only thing in the app
  that does, and `createAdminClient()` documents that. `SUPABASE_SERVICE_ROLE_KEY`
  must be set in Vercel and locally; without it this flow errors and nothing
  else is affected.
- Accounts that opt in are measurably easier to compromise than accounts that
  don't. That is the trade, made knowingly.
- Three answers per user is a hard-coded assumption in the schema
  (`position between 1 and 3`), the RPC and the form. Changing it is a
  migration.

## Removal

**This is meant to be deleted.** When transactional email is wired up:

1. Switch the forgotten-password link to Supabase's own reset flow.
2. Delete `/recovery/reset`, `verifyAnswers`, `resetWithToken`,
   `verify_recovery_answers`, `redeem_recovery_token`, `recovery_questions_for`,
   `security_answers`, `recovery_attempts` and `recovery_tokens`.
3. Keep or drop `profiles.password_hint` on its own merits — it's harmless but
   pointless once email works.
4. Supersede this ADR rather than editing it.

Leaving it in place after email exists would mean carrying the weakness with
none of the justification.

## Alternatives considered

- **No recovery at all.** Honest and secure, and it means a forgotten password
  is a lost account. Rejected on the user's explicit call.
- **Supabase's default SMTP.** Exists, but is heavily rate limited and not
  intended for production delivery — unreliable in exactly the moment it
  matters.
- **Recovery codes** — a set of one-time codes shown at signup. Cryptographically
  much better and the standard answer. Rejected because a code shown once and
  never seen again is the thing an ADHD-focused product should least rely on;
  the user who needs recovery is the one who won't have saved it.
