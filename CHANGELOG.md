# Changelog

All notable changes to Streakproof are recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Because Streakproof is a deployed app rather than a published library, "public
API" for versioning purposes means **the database schema and the user-facing
behaviour**:

- **Major** — a migration that requires manual intervention, or a change that
  breaks an existing user's saved plans or logs.
- **Minor** — a new user-facing capability, a new table, or a backwards-
  compatible migration.
- **Patch** — bug fixes, dependency bumps, copy and styling, docs.

Entry types, in the order they should appear under a version: `Added`,
`Changed`, `Deprecated`, `Removed`, `Fixed`, `Security`. Add a `Database`
subsection when a release includes a migration, naming the migration file — see
[docs/MIGRATIONS.md](docs/MIGRATIONS.md).

Every version below is a git tag (`v0.1.0`). Compare links at the bottom.

---

## [Unreleased]

### Added

- **Plan reviews.** `lib/review.ts` implements the time, stalled and adherence
  checks; home records what's due and shows one quiet card with three plain
  options, one of them "it's fine as it is". Every threshold is deliberately
  hard to trip — a stall needs *two* lifts flat across four sessions, adherence
  needs four weeks of history and under 60% of planned sessions, and `season` is
  deliberately not implemented because nothing knows when a season starts. See
  [ADR 0015](docs/decisions/0015-review-triggers-are-quiet-by-default.md).
- **`/food/edit`** — the food plan editor the gym side has always had. Three
  tabs: bowls (with per-component toggles grouped by role), pantry (add, rename,
  mark batch-cooked, delete), and prep (rename, set the weekday, edit steps).
  Same save-on-blur, same Retry-on-failure, same no-refresh-on-error rule as the
  program editor.
- **The food side has screens.** `/food` shows the bowl rotation with a
  suggestion, the two fallback tiers under "Nothing prepped", what you've eaten
  today, and a free-text box for everything else. `/food/prep` is the Sunday and
  Wednesday checklist. `/setup/food` picks a food plan. Schema and seeded
  template have existed since v2; this is the UI.
- **`suggestBuild()`** picks whichever bowl you've gone longest without, beside
  `suggestDay()` and pure like it. Fallback builds are excluded — the
  four-minute meal is a floor you drop to, never something the app tells you to
  cook.
- **`prepDueOn()`** — prep sessions are weekday-bound (unlike workout days, and
  deliberately so), but a missed one goes `overdue` rather than waiting a week,
  because the answer is twenty minutes at the shop. See
  [ADR 0014](docs/decisions/0014-food-ui-mirrors-the-gym-side.md).
- **Free-text meal logging as a first-class path**, not an "other" bucket.
  `meal_logs.name` with a null `build_id` has its own input and its own copy:
  nothing logged is a cheat.
- **Home's food card is real** — it shows the suggested bowl, how long since you
  last had it, and what you've logged today.
- Eighteen new assertions covering the build rotation and prep-session states
  (`npm test` is now 73).

- **Signup asks for a name, email, password and confirmation**, validated in the
  browser and again in the server action. The rules live in `lib/validate.ts` so
  the two can't drift; the server copy is the one that holds, because a server
  action is a public endpoint. Minimum password length is 8, up from Supabase's
  floor of 6.
- **Account recovery — password hint and security questions.** Optional and
  skippable, offered once after signup and reachable later from the drawer.
  Answers are bcrypt hashed in Postgres, `security_answers` has **no select
  policy** so nobody can read them back, verification is rate limited to five
  attempts per email per hour, and wrong answers are indistinguishable from an
  unknown account. This is an interim measure to be deleted once transactional
  email exists — [ADR 0012](docs/decisions/0012-security-questions-as-interim-recovery.md)
  says how.
- **The reset asks the security questions one at a time and passes on two of
  three.** Forgetting one answer no longer means a permanently locked account.
  All three are still asked and the verdict still arrives once, at the end:
  showing only two would let someone who knows two answers retry until that pair
  came up, and per-question feedback would make each answer attackable on its
  own. A blank counts as wrong, so a forgotten answer can be left empty.
- **`/recovery` and `/recovery/reset`**, plus a "Forgotten your password?" link
  on sign-in. The reset runs in three steps — email, then the questions, then
  the new password — joined by a single-use 256-bit token that expires in ten
  minutes. Doing it on one form would mean learning the answers were wrong only
  after choosing a password. On success the hint is shown next to the password
  form with a "remembered it? sign in instead" link, since the hint is often all
  that was needed.
- **Three more starting plans, five in total** — `bodyweight-anywhere` (no
  equipment), `fat-loss-full-body` (three days, conditioning finishers) and
  `push-pull-legs-muscle` (hypertrophy, full gym). The picker now orders by how
  demanding a plan is rather than by name, and labels each with who it's for.
- **`/build` — the custom-build questionnaire.** Twelve questions writing to
  `builder_profiles`, reachable from "Would you rather custom build your workout
  routine?" on the setup page. Adapted from the intake used by hand to build the
  original templates: the name question is gone (the profile has it) and
  "how long have you got per session?" is new, because the app displays duration
  estimates and had no idea what the user's budget was.
- **Current and goal weight on the intake**, both optional, with a lb/kg
  toggle. Validation is a typo guard only — impossible numbers and unit
  mix-ups — because it isn't the app's business to editorialise about a number
  on a scale. A goal above current is explicitly allowed; people bulk. The care
  belongs in the generator, which gets a hard calorie floor and no
  aggressive-cut presets before any of this goes public.
- **An optional reference photo on the intake**, uploaded to a **private**
  storage bucket. Per-user folders enforced by RLS on `storage.objects`, a 5 MB
  cap and an images-only MIME allowlist enforced by the bucket rather than only
  by the client, and no public-read policy at all — reads go through expiring
  signed URLs. `text/html` is excluded specifically; a bucket that accepts it is
  a stored-XSS vector.
- **`gen_seed.py --only <slugs>`**, which is what makes a delta template
  migration possible now that the original is applied and immutable.
- Nineteen new assertions in `npm test` (46 total) covering signup and recovery
  validation, answer normalisation and the intake; and ten more in the SQL
  harness (22 total) covering the template library, hashing, unreadability and
  the rate limiter.

- **A home screen.** `/` is now a summary: the date, a greeting, the "never miss
  twice" nudge when it applies, today's suggested session, the food plan's
  state, and three headline stats. It used to render the set logger directly —
  the first thing the app ever showed you was a grid of empty inputs.
- **Day suggestion.** `suggestDay()` in `lib/suggest.ts` picks the day you're
  most due for: never-done wins outright in `sort` order, otherwise longest
  since last done, ties broken by `sort`. Days stay a rotation with no weekday
  binding, so a missed day can't desynchronise anything. See
  [ADR 0010](docs/decisions/0010-home-is-a-summary.md).
- **Account drawer** (`components/UserDrawer.tsx`) — right-edge panel holding
  plan editing, plan switching, timezone and sign out. Modelled on
  SquirreLingo's, with three things that one lacks: it animates out as well as
  in, it carries proper dialog semantics (`role="dialog"`, `aria-modal`, focus
  in and restored, body scroll lock), and nothing in it is the only path to
  anything. See [ADR 0011](docs/decisions/0011-bottom-nav-plus-account-drawer.md).
- **`loadFoodSummary()`** — reads the active food plan and its builds without
  redirecting. Having no food plan is a normal state the home screen renders
  honestly, not a reason to bounce someone to `/setup`.
- **`hourIn()` and `longDate()`** in `lib/dates.ts`, for the timezone-correct
  greeting and date line.
- Eleven new assertions covering the rotation suggestion and the greeting
  boundaries (`npm test` is now 27).
- **`docs/MEAL-FRAMEWORK.md`** — the reasoning behind the food side, which until
  now only existed in chat. The schema and seeded template encode it; this is
  the *why*. Verified against `20260802000004_templates.sql`: 6 builds, 25
  pantry items across five roles, two prep sessions, all matching.

### Changed

- **The set logger moved to `/workout`** and accepts `?day=<key>`, which is how
  home hands off its suggestion. `?date=` backfill is unchanged.
- **Bottom nav is Home / Workout / Food / History / Progress.** Five tabs is the
  ceiling; anything further goes in the drawer.
- **Bottom nav previously became Home / Workout / History / Progress.** `Edit` moved into
  the drawer — it's a settings action, not somewhere you hop between sets.
- **`Tracker` is just the logger now.** The greeting, plan name, three-stat row,
  nudge and sign-out button all moved to home or the drawer rather than being
  shown twice; its header is the day title and a link back. `displayName`,
  `planName` and `stats` are no longer props.

### Fixed

- **Recovery hashing failed in production with `function gen_salt(unknown,
  integer) does not exist`.** Supabase installs pgcrypto into an `extensions`
  schema, not `public`, so `create extension if not exists pgcrypto` was a
  no-op and `set search_path = public` on the recovery functions couldn't
  resolve `crypt()`, `gen_salt()` or `gen_random_bytes()`. The search path now
  includes `extensions`, which stays correct on a stock Postgres too, since a
  missing schema in `search_path` is ignored.
- **The SQL harness installed pgcrypto into `public`**, so every assertion
  passed against a schema layout production doesn't have. The stub now creates
  it in `extensions` exactly as Supabase does — with that change the harness
  reproduces the production failure, which is the only reason to trust it now.
- **A wrong security answer wiped all three fields.** React 19 resets an
  uncontrolled form once its action completes, so one typo cost the user every
  answer — with only five attempts an hour, and while they're already locked
  out. The answer fields are controlled now.
- **An unreadable profile sent you to the template picker instead of sign-in.**
  `loadPlan()` discarded the error from the profile query, so a failed read and
  a user with no plan were indistinguishable — both produced a null plan id and
  a redirect to `/setup`. An expired session that still satisfies `getUser()`
  lands exactly there, so the symptom was being shown "pick a starting plan"
  when the real answer was "sign in again". The error is now surfaced and logged,
  and an unreadable profile redirects to `/login`. `/setup` is reached only after
  positively reading a profile that has no active plan. Same principle as
  [ADR 0007](docs/decisions/0007-server-actions-return-result.md), applied to
  reads: never let a failure impersonate a legitimate empty state.
- **`npm run seed:gen` had been broken for a month.** It imported the v1
  generator at `supabase/gen_seed.py`, which was deleted as a "v1 leftover" in
  `628d992` — except it held the exercise text for both gym templates. Nothing
  noticed because nothing re-ran the generator. The data is now inlined and the
  cross-file import is gone; regenerating produces the two original templates
  byte-identically to what is applied in production. See
  [ADR 0013](docs/decisions/0013-repair-the-seed-generator.md).
- **The SQL harness asserted a template count, not a template set.** It now
  asserts the exact expected slugs, plus that every gym template has days,
  exercises and duration estimates — a count would let one silently vanish.
- **The drawer's scrim left the bottom nav undimmed and clickable.** Both were
  `z-40`, and at equal z-index DOM order wins — `BottomNav` renders after
  `<main>`. Scrim is now `z-50` and the panel `z-[60]`. Caught by driving the
  deployed app, not by reading the code.

### Database

Six migrations. The last needs `npm run db:push`:

- `20260803000001_account_recovery.sql` — applied
- `20260803000002_more_templates.sql` — applied
- `20260803000003_intake_images.sql` — applied
- `20260803000004_recovery_tokens.sql` — applied
- `20260803000005_fix_pgcrypto_search_path.sql` — applied
- `20260803000006_two_of_three_answers.sql` — **not yet applied**

Each was applied in order against stock Postgres 16 with the RLS harness
passing before being committed. See [docs/MIGRATIONS.md](docs/MIGRATIONS.md).

---

## [0.1.0] — 2026-08-02

First deployed release. Live at `streakproof-app.vercel.app`, tracking both
users, gym side complete.

### Added

- **Plan reviews.** `lib/review.ts` implements the time, stalled and adherence
  checks; home records what's due and shows one quiet card with three plain
  options, one of them "it's fine as it is". Every threshold is deliberately
  hard to trip — a stall needs *two* lifts flat across four sessions, adherence
  needs four weeks of history and under 60% of planned sessions, and `season` is
  deliberately not implemented because nothing knows when a season starts. See
  [ADR 0015](docs/decisions/0015-review-triggers-are-quiet-by-default.md).
- **`/food/edit`** — the food plan editor the gym side has always had. Three
  tabs: bowls (with per-component toggles grouped by role), pantry (add, rename,
  mark batch-cooked, delete), and prep (rename, set the weekday, edit steps).
  Same save-on-blur, same Retry-on-failure, same no-refresh-on-error rule as the
  program editor.
- **The food side has screens.** `/food` shows the bowl rotation with a
  suggestion, the two fallback tiers under "Nothing prepped", what you've eaten
  today, and a free-text box for everything else. `/food/prep` is the Sunday and
  Wednesday checklist. `/setup/food` picks a food plan. Schema and seeded
  template have existed since v2; this is the UI.
- **`suggestBuild()`** picks whichever bowl you've gone longest without, beside
  `suggestDay()` and pure like it. Fallback builds are excluded — the
  four-minute meal is a floor you drop to, never something the app tells you to
  cook.
- **`prepDueOn()`** — prep sessions are weekday-bound (unlike workout days, and
  deliberately so), but a missed one goes `overdue` rather than waiting a week,
  because the answer is twenty minutes at the shop. See
  [ADR 0014](docs/decisions/0014-food-ui-mirrors-the-gym-side.md).
- **Free-text meal logging as a first-class path**, not an "other" bucket.
  `meal_logs.name` with a null `build_id` has its own input and its own copy:
  nothing logged is a cheat.
- **Home's food card is real** — it shows the suggested bowl, how long since you
  last had it, and what you've logged today.
- Eighteen new assertions covering the build rotation and prep-session states
  (`npm test` is now 73).

- **Two-user gym tracker** — per-set logging, PR badges, streaks, a progress
  chart, session history, a rest timer, and an in-app program editor. Installable
  as a PWA.
- **Plans, templates, and cloning.** Plans are either templates (`owner_id is
  null`, `is_template`) or plans a user owns. Picking a template calls
  `clone_plan()`, which copies it, so any number of users can start from the same
  template and edit their copy. See [ADR 0001](docs/decisions/0001-copy-on-select-plan-ownership.md).
- **Food schema and a seeded food template** — pantry items, builds, prep
  sessions, prep tasks, meal and prep logs, and a designated fallback build. No
  UI yet; the tables and one template exist.
- **Backfill.** A missed day can be filled in later via `?date=…`, guarded
  server-side by `sanitizeLogDate()`.
- **Variable set counts.** A fourth set on a three-set exercise now has somewhere
  to go, via an "+ add set" control.
- **Duration estimates.** `estimate_day_minutes()` and
  `refresh_plan_estimates()` keep `days.est_minutes` current; day tabs show
  "~48 min". The short-version estimate is generated, not hand-written, which is
  what makes the bad-day option a real option.
- **Calorie tracking as an overlay** — `plans.tracking_mode` (`none` | `protein`
  | `full`) rather than a forked schema. See [ADR 0004](docs/decisions/0004-tracking-mode-overlay.md).
- **`builder_profiles` and `ai_generations`** tables, ahead of the AI builder.
  `ai_generations` is deliberately not client-writable — only the service role
  inserts.
- **Test coverage for the parts that silently corrupt data** — 16 assertions on
  date and streak logic (`npm test`), and a 17-assertion SQL harness in
  `supabase/tools/test/` that runs the migrations against stock Postgres in
  `db push` order and asserts the RLS and anon boundaries.
- **`npm run verify:db`** — checks that a live Supabase project actually has the
  schema loaded.

### Changed

- **"Never miss twice" compares against the user's own median gap** rather than
  a fixed three-day threshold, so a once-a-week lifter isn't nagged on day three.
  See [ADR 0009](docs/decisions/0009-never-miss-twice-median-gap.md).
- **Server actions return `{ ok, error }`** and callers surface the failure.
  Previously they returned void and discarded the Supabase error. See
  [ADR 0007](docs/decisions/0007-server-actions-return-result.md).
- **Stack upgraded to current** alongside the same exercise on Squirrelingo:
  Next 14.2.35 → 16.2.12 (Turbopack is now the default builder), React 18.3.1 →
  19.2.8, Tailwind 3.4 → 4.3, `@supabase/ssr` 0.5.2 → 0.12.4,
  `@supabase/supabase-js` 2.45.4 → 2.111.0, Supabase CLI 2.2.1 → 2.111.0,
  TypeScript → 5.9.3, `@types/node` → ^22 (pinned to the runtime, not `latest`).
  This required: `cookies()` is async, so `createClient()` is async and all
  eleven call sites await it; `searchParams` is async; `middleware.ts` →
  `proxy.ts` via `npx @next/codemod@canary middleware-to-proxy .`; Tailwind 4 is
  CSS-first, so `tailwind.config.ts` is gone and the eleven colour tokens are
  `--color-*` entries in an `@theme` block in `app/globals.css`.
  `npm audit` went 21 advisories → 3, all three inside Next's own vendored
  `postcss` and `sharp`.
- **Schema is shipped as CLI-pushable migrations** (`supabase db push`) instead
  of SQL files pasted into the Supabase web console. See
  [ADR 0008](docs/decisions/0008-migrations-over-pasted-sql.md).
- **Templates are generated** by `supabase/tools/gen_seed.py` rather than
  hand-written SQL. See [ADR 0006](docs/decisions/0006-generated-template-seeds.md).
- README, CLAUDE.md and STATEOFPLAY.md rewritten to describe the app as it
  actually is.

### Removed

- **Ownership claiming.** In v1 the first user to pick a program owned it
  forever and nobody else could use it. That made a second plan — and therefore
  the entire food side — impossible.
- `profiles.program_id`, replaced by one active plan per `kind`
  (`active_gym_plan_id`, `active_food_plan_id`).
- `next lint` script — removed in Next 16, and there was no ESLint config in the
  repo anyway.
- v1 leftovers: `supabase/gen_seed.py`, `schema.sql`, `seed.sql`.
- `tailwind.config.ts` and `autoprefixer`, both obsolete under Tailwind 4.

### Fixed

- **Dates were stored in UTC.** A 9pm Eastern workout was filed under tomorrow,
  corrupting streaks, "last time" and PR detection. Every stored date is now the
  user's local date, derived from `profiles.timezone`, via `lib/dates.ts`. See
  [ADR 0002](docs/decisions/0002-local-dates-not-utc.md).
- **Backfill was undoing itself.** `Tracker` seeds its set state in a `useState`
  initializer, which runs once on mount — and a client-side nav to `?date=…`
  stays on the same route, so the instance survived and the previous date's typed
  values were written to the newly selected day. Fixed with
  `<Tracker key={activeDate}>`. Verified in the running app, not just in a build.
- **Writes failed silently on bad gym wifi.** `persist()` awaited `saveSet`
  inside a transition and discarded the result: the number stayed on screen and
  was never saved. Now surfaced per row with a retry.
- **`ProgramEditor` swallowed save errors.** It now shows a Retry banner, and on
  failure deliberately skips `router.refresh()` — refreshing replaces the inputs
  with the server's unchanged values and destroys what was just typed.
- **Production returned `500 MIDDLEWARE_INVOCATION_FAILED` on every route.** The
  cause was the Vercel project's Framework Preset being `Other` instead of
  `Next.js`, so the Next.js builder never ran: `public/` was published
  statically, middleware was bundled generically (which is how `__dirname` ended
  up in an Edge bundle), and no App Router page was deployed at all. See
  [ADR 0005](docs/decisions/0005-vercel-framework-preset.md).
- **`proxy.ts` must use relative imports**, not the `@/` alias — Vercel bundles
  it separately from the app build and the alias fails there while compiling
  fine locally.
- **`verify:db` reported success against a database with no schema**, twice:
  first because it only matched Postgres' `42P01` and not PostgREST's `PGRST205`,
  then because it queried templates as a signed-out user while the read policy
  was `TO authenticated`.

### Security

- **RLS on all 16 tables**, with `owns_plan` / `can_read_plan` helpers for
  reference data hanging off a plan.
- **Anon can read templates only** (`20260802000005_public_template_reads.sql`),
  scoped to `is_template` rows so the signed-out template picker works without
  exposing user plans.
- The `service_role` key is never in the client bundle or the repo.
  `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are public by
  design; RLS is what protects the data.

### Database

Migrations `20260802000001` … `20260802000005`, all applied to
`qpxzyzdzunazfvgxnrfz`. See [docs/MIGRATIONS.md](docs/MIGRATIONS.md).

---

## Prior history

v1 was a working two-person tracker but was **never deployed and never
released**, so it carries no version number. Its architecture — a single
`profiles.program_id` and claimed program ownership — is the thing 0.1.0
replaced. The reasoning is preserved in
[docs/V2-CODE-CHANGES.md](docs/V2-CODE-CHANGES.md).

<!-- Update the tag in the Unreleased link on every release. -->
[Unreleased]: https://github.com/sdlaw90/streakproof/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sdlaw90/streakproof/releases/tag/v0.1.0
