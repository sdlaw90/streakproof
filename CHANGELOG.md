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
- **`/recovery` and `/recovery/reset`**, plus a "Forgotten your password?" link
  on sign-in.
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
- **Bottom nav is now Home / Workout / History / Progress.** `Edit` moved into
  the drawer — it's a settings action, not somewhere you hop between sets.
- **`Tracker` is just the logger now.** The greeting, plan name, three-stat row,
  nudge and sign-out button all moved to home or the drawer rather than being
  shown twice; its header is the day title and a link back. `displayName`,
  `planName` and `stats` are no longer props.

### Fixed

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

Two migrations, **neither applied to production yet** — both need
`npm run db:push`:

- `20260803000001_account_recovery.sql`
- `20260803000002_more_templates.sql`

Both were applied in order against stock Postgres 16 with the RLS harness
passing before being committed. See [docs/MIGRATIONS.md](docs/MIGRATIONS.md).

---

## [0.1.0] — 2026-08-02

First deployed release. Live at `streakproof-app.vercel.app`, tracking both
users, gym side complete.

### Added

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
