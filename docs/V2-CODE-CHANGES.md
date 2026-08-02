# Streakproof — v1 → v2 code change map

The v2 SQL lives in `supabase/migrations/`. v1 was never deployed, so there was
no data to migrate: v2 was a fresh install.

**This document is a historical record.** Steps 1–7 are done and the prose below
still describes them in the imperative, as it was written before the work
happened. Read it for *why* a change was made, not as a to-do list. Current
status lives in `STATEOFPLAY.md`; conventions live in `CLAUDE.md`.

## Status

| Step | State |
|------|-------|
| 1. Types | **done** |
| 2. Loaders | **done** |
| 3. Template picker + `clone_plan` | **done** |
| 4. Deploy-blockers (UTC, backfill, variable sets, save failures) | **done** |
| 5. Plan editor | **done** |
| 6. Duration + review triggers | duration shipped; review checks not written |
| 7. "Never miss twice" | **done** |
| 8. Food UI | not started |
| 9. AI builder | not started |

The app now queries v2 and nothing else. `npm run build` and `npx tsc --noEmit`
are clean; `npm test` covers the date and streak logic; `npm run verify:db`
checks a live Supabase project has the schema loaded. The app is deployed and
rendering at `streakproof-app.vercel.app`.

Two follow-ups landed on 2 Aug 2026 after the deploy came up, both of them
regressions of principles this document already states:

- **Step 4's backfill was undoing itself.** `Tracker` seeds its local set state
  in a `useState` initializer, which runs once on mount; a client-side nav to
  `?date=…` stays on the same route and keeps the instance, so the previous
  date's typed values stayed on screen and were written to the new date.
  `<Tracker key={activeDate}>` in `app/page.tsx` forces the remount.
- **Step 5's editor swallowed errors.** `app/program/actions.ts` returned void
  and discarded the Supabase error — the same silent-write bug step 4 fixed in
  the set logger. Actions now return `{ ok, error }` and `ProgramEditor` shows a
  Retry banner.

---

## What changed in the database, in one paragraph

`programs` became `plans`, which are either **templates** (`owner_id is null`,
`is_template`) or plans a user **owns**. Picking a template calls
`clone_plan()`, which copies it — nobody claims anything, so any number of
users can start from the same template and edit their copy freely. Plans have a
`kind` (`gym` | `food`), and `profiles` now holds one active plan *per kind*
instead of a single `program_id`. The food side has its own tables because it
needs quantities, optional nutrition, and a many-to-many between reusable
pantry items and the builds that use them. Calorie counting is
`plans.tracking_mode`, an overlay on the same tables rather than a second app.

---

## Step 1 — Types (`lib/types.ts`)

- `Program` → `Plan`, plus the new columns: `kind`, `is_template`, `owner_id`,
  `source`, `template_id`, `visibility`, `tracking_mode`, `started_on`,
  `review_after_weeks`, `last_reviewed_on`, `archived_at`.
- `Day.program_id` → `Day.plan_id`; add `est_minutes`.
- `Exercise`: add `work_seconds`, `rest_seconds`, `optional`.
- New food types: `FoodItem`, `Build`, `BuildItem`, `PrepSession`, `PrepTask`,
  `MealLog`, `PrepLog`.
- New: `BuilderProfile`, `PlanReview`.

## Step 2 — Loaders (`lib/load.ts`)

- The profile select currently joins `program:programs(...)`. Replace with
  `active_gym_plan_id`, `active_food_plan_id`, `timezone`, and a join to
  `plans`.
- `.eq("program_id", ...)` → `.eq("plan_id", ...)` on the `days` query.
- Redirect to `/setup` when the *relevant* active plan is null — a user with a
  gym plan but no food plan should not be bounced off the gym page.
- Add `loadFoodPlan()` mirroring `loadProgram()`.

## Step 3 — Template picker (`app/setup/`)

- `page.tsx`: query `plans` where `is_template` and `kind = 'gym'` (add a food
  step later). Show `description` — templates now have one.
- `actions.ts`: replace `chooseProgram()` (which set `profiles.program_id` and
  claimed `owner_id`) with:

  ```ts
  const { data, error } = await supabase.rpc("clone_plan", {
    p_source_id: templateId,
  });
  ```

  `clone_plan` copies the plan, sets `owner_id`, activates it on the profile,
  and returns the new plan id. Ownership claiming is gone entirely.

## Step 4 — Deploy-blockers (independent of the schema, do them any time)

These are all code-only and were verified as real while reading v1:

1. **UTC dates** — `todayUTC()` in `app/actions.ts` and `app/page.tsx` (and
   `app/progress/page.tsx`). Evening lifts in Eastern time get written as
   *tomorrow*, which corrupts streaks, "last time", and PR detection. Use the
   user's `profiles.timezone` (new column, defaults to `UTC`) to compute the
   local date.
2. **Can only log today** — `ensureTodaySession()` hardcodes today. Take
   `performedOn` as a parameter so a missed Wednesday can be filled in on
   Thursday. The unique constraint `(user_id, day_id, performed_on)` already
   supports this.
3. **Fixed set count** — `Tracker.tsx` renders exactly `ex.sets` rows, so a
   fourth set has nowhere to go. `set_logs.set_number` is just an int; add an
   "+ add set" control and let the row count exceed `ex.sets`.
4. **Silent save failures** — `persist()` in `Tracker.tsx` awaits `saveSet`
   inside a transition and discards the result. On bad gym wifi the number
   stays on screen and is never written. Surface an unsaved/retry state.

## Step 5 — Program editor (`app/program/`)

- `program_id` → `plan_id` throughout; ownership checks now come free from RLS
  (`owns_plan`), so the "are you the owner" branch can go.
- Add `rest_seconds` / `work_seconds` / `optional` to the exercise editor.
- Call `refresh_plan_estimates(plan_id)` after edits so `days.est_minutes`
  stays honest.

## Step 6 — Duration and review

- Show `days.est_minutes` on the day tabs ("~48 min").
- `estimate_day_minutes(day_id, 6, false)` gives the short-version estimate —
  that's the bad-day option, generated rather than hand-written.
- Write the review checks (time / stalled / adherence / season) as pure
  functions next to `lib/stats.ts`, inserting into `plan_reviews`. Keep them
  pure — they're the easiest thing in the app to unit test and the easiest to
  get subtly wrong.

## Step 7 — "Never miss twice", properly

Currently a static gold line when `lastAgoDays >= 3`, on a week-granularity
streak. It's the best rule in the plan and the app barely implements it. The
data needed is already there in `sessions`.

## Step 8 — The food side

Routes under `/food` mirroring the gym ones: builds instead of days, a prep-day
checklist from `prep_sessions` / `prep_tasks`, and the fallback tier surfaced
separately (`builds.is_fallback`) so a bad day has a designed answer.
`tracking_mode` decides whether nutrition fields appear at all.

## Step 9 — The AI builder

- `builder_profiles` stores the intake (jsonb, one row per user per kind) so it
  can drive generation, regeneration, and the review flow.
- `ai_generations` records every call — that's what makes rate limiting,
  caching, and "why did it give me this?" possible. It's deliberately
  **not** client-writable: only the service role inserts.
- Generation returns validated JSON that gets inserted through the same path a
  template clone uses. The model never writes SQL and never renders unvalidated
  text.

---

## Testing

`supabase/tools/test/` runs the whole schema against stock Postgres, applying the
migrations in the same filename order `supabase db push` uses:

```bash
createdb sp
psql -d sp -f supabase/tools/test/00_supabase_stub.sql   # fakes auth.users + auth.uid()
for f in supabase/migrations/*.sql; do psql -d sp -v ON_ERROR_STOP=1 -f "$f"; done
psql -d sp -f supabase/tools/test/01_rls_test.sql        # asserts; aborts on any failure
```

Currently passing, including the two cases v1 could not do:

- two different users cloning the same template
- one user being unable to see or read another user's plans

and the clone's real failure mode — copied `build_items` still pointing at the
template's `food_items` instead of the new copies — is asserted against
explicitly.

> The stub is **test-only** and lives outside `migrations/` on purpose, so
> `supabase db push` never sees it. Never run it against
> Supabase; it would shadow the real auth schema.
