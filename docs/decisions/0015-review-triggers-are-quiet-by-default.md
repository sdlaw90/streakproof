# 0015 — Review triggers are quiet by default

- **Status:** Accepted
- **Date:** 2026-08-03

## Context

`plan_reviews` has existed since v2 with nothing writing to it. The idea — the
app noticing when a plan has stopped fitting and offering to rebuild it — is the
loop that makes the AI builder worth having, because a generated plan nobody
revisits is just a fancier template.

The risk is obvious and worth naming: **this is the feature most likely to turn
the app into something that judges you.** Streakproof's whole premise is
forgiveness rather than streaks, and a prompt saying "you've fallen behind"
every time you open the app is the same failure as a broken streak counter,
wearing a more helpful face.

## Decision

Four checks, three of them implemented, all pure functions in `lib/review.ts`
beside `lib/stats.ts`. Every one is deliberately hard to trigger.

- **`time`** — the block has run `review_after_weeks`. Uses the same arithmetic
  as `review_due_on()` in Postgres on purpose: if the app and the database
  disagree about when a plan is due, the prompt appears and disappears depending
  on which one you asked.
- **`stalled`** — a top set flat *or falling* across four sessions, and only
  when **two or more** lifts qualify. One plateau is normal and often
  intentional. Deliberately not "hasn't hit a PR": PRs get rarer the longer you
  train, and treating that as failure is how a plan starts lying to an
  intermediate lifter.
- **`adherence`** — under 60% of the sessions the plan implies, and only after
  four weeks of history. Framed as *the plan being wrong about your life*, not
  you failing it: a three-day plan you do once a week should become a one-day
  plan, and the copy says exactly that.
- **`season`** — a valid `reason` in the schema, deliberately **not**
  implemented. Nothing knows when a sport season starts or ends, so firing it
  would be guessing. It stays available for a manually created review.

The UI is one quiet card with three plain options, one of which is "it's fine as
it is". Dismissal is a first-class choice, not a hidden ✕.

## Consequences

- The unique partial index `plan_reviews_open_idx` means recording is
  idempotent — the same check firing on every page load can't stack up. That's
  why home can write on render without creating duplicates.
- Dismissing sets `status = 'dismissed'`, which frees the partial index slot, so
  the same check *can* fire again later if it's still true. That's intended:
  dismissing "you've stalled" shouldn't silence it forever, but it should stop
  it appearing every time you open the app this week.
- "Tweak this one" and "Build a new one" both mark the review `acted` and reset
  `last_reviewed_on`. Without that reset, saying "I've looked, it's fine" would
  re-prompt tomorrow.
- Every threshold is a constant at the top of `lib/review.ts`
  (`STALL_SESSIONS`, `ADHERENCE_MIN_DAYS`, `SESSIONS_PER_WEEK_ASSUMED`), so
  tuning them is a one-line change and shows up in a diff.
- `SESSIONS_PER_WEEK_ASSUMED` is a hard-coded 3. Plans don't record an intended
  frequency; the intake now asks for one, so when the generator lands this
  should read from `builder_profiles` instead of assuming.

## Alternatives considered

- **Compute reviews on the fly, no table.** Cheaper, and it makes dismissal
  impossible — the prompt would return on the next render. The table exists so
  "no" can be remembered.
- **A cron job.** Better for a public app and unnecessary for two users; the
  checks are cheap and home already loads everything they need.
- **Lower thresholds.** Every one of these could fire more often. None of them
  should — the cost of a false positive here isn't a wasted tap, it's the app
  becoming something you avoid opening.
