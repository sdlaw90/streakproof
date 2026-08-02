# Streakproof — v1 → v2 code change map

The v2 SQL is written, tested, and lives in `supabase/v2/`. **The app code has
not been changed yet** — it still queries the v1 tables, so pointing the current
code at a v2 database will fail. This document is the work list to close that
gap, ordered so each step leaves the app in a working state.

Nothing was ever deployed, so there is no data to migrate: v2 is a fresh install.

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

`supabase/v2/test/` runs the whole schema against stock Postgres:

```bash
psql -f test/00_supabase_stub.sql   # fakes auth.users + auth.uid()
psql -f 01_schema.sql -f 02_functions.sql -f 03_rls.sql -f 04_seed.sql
psql -f test/01_rls_test.sql        # asserts; aborts on any failure
```

Currently passing, including the two cases v1 could not do:

- two different users cloning the same template
- one user being unable to see or read another user's plans

and the clone's real failure mode — copied `build_items` still pointing at the
template's `food_items` instead of the new copies — is asserted against
explicitly.

> The stub is **test-only**. Never run `test/00_supabase_stub.sql` against
> Supabase; it would shadow the real auth schema.
