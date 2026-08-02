# 0002 — Store the user's local date, never UTC

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

v1 computed "today" with `new Date().toISOString().slice(0,10)`. In Eastern
time that rolls over at 8pm (EDT) — so an evening lift was filed under
*tomorrow*. That is not a display bug. It silently corrupts streaks, "last
time", and PR detection, and it does so most often for exactly the user this app
is for: someone training after work.

## Decision

Every stored date is the user's **local** date, derived from
`profiles.timezone` (new column, defaults to `UTC`, self-healing from the
browser) via `lib/dates.ts`. Client-supplied dates go through
`sanitizeLogDate()`. `new Date().toISOString().slice(0,10)` is banned from the
codebase.

## Consequences

- `ensureTodaySession()` takes `performedOn` as a parameter rather than
  hardcoding today, which is what makes backfill (`?date=…`) possible at all.
  The unique constraint `(user_id, day_id, performed_on)` already supported it.
- Date logic lives in `lib/` as pure functions with no DB access, so it is unit
  tested without a database. `npm test` includes an assertion reproducing the
  exact UTC bug.
- A user who travels across timezones will see their dates shift with
  `profiles.timezone`. Accepted; the alternative is worse for the common case.

## Alternatives considered

- **Store UTC timestamps and convert on read** — correct in the abstract, but
  every streak and "same day" comparison then needs the timezone anyway, and
  each one is a fresh chance to get it wrong.
- **Send the date from the client and trust it** — no server-side guard, and the
  client clock is not trustworthy. `sanitizeLogDate()` is the compromise: the
  client proposes, the server bounds it.
