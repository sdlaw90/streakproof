# Streakproof — project instructions

Workouts and meal prep for ADHD brains. Miss a day — the plan survives.

Next.js 16 (App Router, Turbopack) · React 19 · Supabase (Postgres + Auth) ·
Tailwind 4 · Vercel. Node 20.9+.
Private for now (Sean + one friend), built to public standards so it can open up
later without a rewrite.

---

## Environment facts

| | |
|---|---|
| Working directory | `C:\Users\sean\Documents\streakproof` |
| Repo | `github.com/sdlaw90/streakproof`, branch `main` |
| Deployed | `https://streakproof-app.vercel.app` |
| Vercel | team `adhd90`, project `streakproof`. **Framework Preset must be `Next.js`** — see Deployment below. |
| Supabase ref | `qpxzyzdzunazfvgxnrfz` |
| Shell | **Windows PowerShell** — never hand Sean bash syntax (`printf`, `export`, heredocs). Use `Set-Content -Encoding ascii` for file writes; PowerShell 5.1 defaults to UTF-16 and silently breaks `.env` files. |

`.env.local` is gitignored and never ships in any archive. It holds
`NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Both are public
by design (`NEXT_PUBLIC_*` is inlined into the client bundle) — RLS is what
protects the data. The **service_role** key is the real secret and must never
reach the client or the repo.

## Commands

```bash
npm run dev          # local dev server
npm run build        # production build — must pass before any push
npx tsc --noEmit     # typecheck
npm test             # pure logic tests (dates, streaks). Needs Node 22.6+
npm run verify:db    # checks a live Supabase project has the schema loaded
npm run db:push      # apply new migrations (npx supabase db push)
npm run seed:gen     # regenerate the template library migration
```

---

## Product principles

These aren't vibes — they're the design constraints the whole app exists to
satisfy. Weigh new features against them.

**No decisions at the point of need.** The plan is decided in advance by a
version of the user with executive function to spare. Anything that asks the
user to choose while depleted is a bug.

**Forgiveness, not streaks.** Every competitor punishes a missed Tuesday. The
name is a promise: missing once is expected and the system survives it. Never
ship a mechanic that shames a gap. "Never miss twice" compares against the
user's *own* median gap, not a fixed threshold.

**Additive, never subtractive.** On the food side especially: add protein and
veg, never remove foods the user likes. Favourite foods get written into the
plan by name so eating them is *executing* the plan, not falling off it.

**Always a defined floor.** Every plan needs a named bad-day option that still
counts — the Pool day on the gym side, `builds.is_fallback` on the food side. A
missing floor is how a system dies, because "nothing prepped" becomes takeout
becomes abandonment.

**Variety by rotation.** Same skeleton, rotating content. Three or four flavour
profiles over one fixed meal; A/B/C days over one fixed workout. Sameness kills
adherence faster than difficulty does.

**Progressive overload, not restriction.** Add one upgrade at a time and only
once the previous one is automatic. Never start a user at everything.

---

## Conventions

### Database

- **Schema changes are new migration files** in `supabase/migrations/`, named
  `<timestamp>_<description>.sql`. Never edit a migration that has been applied
  — `db push` tracks them by name and won't re-run it.
- **Every new table needs RLS policies** in the same migration. Reference data
  hanging off a plan uses the `owns_plan` / `can_read_plan` helpers.
- **Templates are generated**, not hand-written. Edit
  `supabase/tools/gen_seed.py` and regenerate; if the template migration is
  already applied, write a new migration instead.
- **Verify schema changes against real Postgres** before handing them over.
  `supabase/tools/test/` has a stub for Supabase's auth schema and an assertion
  suite. Apply `migrations/*.sql` in filename order, exactly as `db push` does.
  The stub is test-only and lives outside `migrations/` so `db push` never sees
  it.

### Ownership model

Plans are either **templates** (`owner_id is null`, `is_template`) or plans a
user **owns**. Picking a template calls `clone_plan()`, which copies it. Nothing
is ever claimed. This replaced a v1 model where the first user to pick a program
owned it forever and nobody else could use it — don't reintroduce shared mutable
reference data.

### Dates

Every stored date is the user's **local** date, from `profiles.timezone`, via
`lib/dates.ts`. Never `new Date().toISOString().slice(0,10)` — that's UTC, and it
files a 9pm Eastern workout under tomorrow, corrupting streaks, "last time" and
PR detection. Client-supplied dates go through `sanitizeLogDate()`.

### Code

- The Edge entry point is **`proxy.ts`** (Next 16 renamed the `middleware` file
  convention; same matcher, exported function is `proxy`). It must use
  **relative imports**, not the `@/` alias — Vercel bundles it separately from
  the app build and the alias fails there while compiling fine locally.
- Server helpers that touch `cookies()` are **async** (Next 15+), so
  `createClient()` in `lib/supabase/server.ts` returns a promise and every call
  site awaits it. Same for a page's `searchParams`.
- Server actions return `{ ok, error }` and callers surface failures. Never
  swallow a write error — the app is used on bad gym wifi. When surfacing a
  failure, don't `router.refresh()` — that replaces the inputs with the server's
  unchanged values and destroys what the user just typed.
- A client component that seeds state from props in a `useState` initializer
  needs a `key` tied to whatever the props are keyed on. Same-route navigation
  (`?date=…`) keeps the instance alive, so the initializer never re-runs and the
  component silently shows stale data. `<Tracker key={activeDate}>` exists for
  exactly this reason.
- Pure logic (dates, stats, review triggers) goes in `lib/` as plain functions
  with no DB access, so it can be tested without a database.
- The food side has its own tables rather than reusing the gym ones. It needs
  quantities, optional nutrition, and a many-to-many between reusable pantry
  items and builds. Don't merge them.
- Calorie tracking is `plans.tracking_mode` (`none` | `protein` | `full`) — an
  overlay on the same tables. Never fork the schema for it.

### Deployment

- **Framework Preset must be `Next.js`** in Vercel → Settings → Build and
  Deployment. With `Other`, Vercel never runs the Next.js builder: the build
  still reports success and `public/` still serves, but no App Router page is
  deployed as a function and middleware is bundled generically — which is how
  `__dirname` ends up in an Edge bundle. Symptoms are
  `500 MIDDLEWARE_INVOCATION_FAILED` on everything, or a bare `404` on every
  route if middleware is out of the way. This cost an afternoon on 2 Aug 2026.
- Changing project settings does **not** affect existing deployments — they keep
  the config they were built with. Redeploy after any settings change.
- When a deployed app misbehaves but `npm run build` is clean locally, check the
  platform config before the code.

### Design language

Dark, mobile-first, minimal chrome. Tailwind 4 is CSS-first: there is no
`tailwind.config.ts`. Tokens live in the `@theme` block of `app/globals.css`
as `--color-*` custom properties:
`bg #0e1116`, `panel #171c24`, `panel2 #1e2530`, `line #2a323f`, `ink #e8edf4`,
`muted #93a1b5`, `faint #6b7889`, `accent #4fd08a`, `accent2 #3aa6ff`,
`hot #ff7a59`, `gold #ffcf5c`. Rounded cards, gradient progress bars,
tap-to-check.

Tailwind 4 notes: `border-*` defaults to `currentColor`, not gray-200 — always
name a border colour. Gradients are `bg-linear-to-r`, not `bg-gradient-to-r`.

---

## Working agreements

**Don't claim verification you haven't done.** Twice in this project a check
reported success against a database that didn't have the schema, because the
check itself was wrong. If something can't be verified from here — network
egress blocks Supabase from the cloud sandbox, for instance — say so plainly
rather than inferring a pass.

**Say when confidence is low.** Distinguish "I tested this" from "this should
work." Both are fine; conflating them is not.

**Own mistakes plainly and move on.** No spiralling apology.

**Push back when the technically correct answer isn't the useful one.** Sean is
a senior data engineer — assume fluency, skip the hand-holding, but don't assume
familiarity with this app's specifics.

**Prefer one good recommendation over a menu.** When there's a real fork, give
the recommendation first with reasoning, then the alternatives.
