# 🔁 Streakproof

**Workouts and meal prep for ADHD brains. Miss a day — the plan survives.**

A private tracker for two people (you + Ely). Each person signs in, picks a
starting plan, gets their own editable copy, and logs every set. Everything
persists and syncs across devices.

**Stack:** Next.js 16 (App Router, Turbopack) · React 19 · Supabase (Postgres +
Auth) · Tailwind 4 · deploys on Vercel. Everything fits the free tiers.

---

## Features

- **Per-set logging** — weight × reps per set, with a "last time" reference under every exercise
- **Backfill** — log a session you forgot, up to 90 days back, via the date picker
- **Local dates** — "today" comes from your own timezone, so a 9pm lift isn't filed under tomorrow
- **Personal records** — automatic 🏆 PR badge when you beat your best on a lift
- **Never miss twice** — the nudge compares against *your* median gap between sessions, so a weekly lifter isn't nagged on day three
- **Progress charts** — weight-over-time per exercise
- **History** — every past session with the numbers you hit
- **Rest timer** — floating timer with 60/90/120/180s presets
- **In-app plan editor** — add / edit / reorder / delete days and exercises, with duration estimates that recompute as you go
- **Installable (PWA)** — add to your phone's home screen
- **Private by design** — row-level security means you only ever see your own data

Not built yet: the food UI (schema and a template exist, no screens), the AI
plan builder, and the plan-review triggers. See `STATEOFPLAY.md`.

---

## How plans work

A **plan** is either a **template** (`owner_id is null`, `is_template = true`) or
a plan a user **owns**. Picking a template calls `clone_plan()`, which copies it
into a plan of your own — nobody ever claims a shared plan, so any number of
people can start from the same template and edit freely.

Plans have a `kind` (`gym` | `food`), and `profiles` holds one active plan *per
kind*, which is what lets the meal side exist without competing with the gym
side for a single slot.

---

# PART 1 — One-time setup (do this once, on a computer)

You'll need [Node.js](https://nodejs.org) 20.9+ (22.6+ if you want `npm test`),
plus GitHub, Vercel, and Supabase accounts.

## Step 1 — Create the Supabase project

1. [Supabase dashboard](https://supabase.com/dashboard) → **New project**.
2. Name it `streakproof`, set a database password (save it), pick a nearby region.
3. Wait ~2 minutes for provisioning.

> Keeping this separate from Squirrelingo is deliberate — nothing here can
> affect that app.

## Step 2 — Create the database tables

The schema lives in `supabase/migrations/`, so the Supabase CLI pushes it for
you. **You do not need to copy-paste SQL.**

```bash
npx supabase login          # opens a browser
npx supabase link --project-ref <your-project-ref>
npx supabase db push        # asks for your database password
```

Your project ref is the subdomain of your project URL — for
`https://abcdefgh.supabase.co` it's `abcdefgh`. The database password is
resettable under **Project Settings → Database**.

That applies five migrations in filename order:

| File | What it does |
|------|--------------|
| `20260802000001_schema.sql` | Tables (16 of them) |
| `20260802000002_functions.sql` | `clone_plan()`, duration estimates, RLS helpers |
| `20260802000003_rls.sql` | Row-level security policies |
| `20260802000004_templates.sql` | Template library (2 gym plans + 1 meal plan) |
| `20260802000005_public_template_reads.sql` | Lets signed-out visitors see the templates |

Then confirm it landed:

```bash
npm run verify:db
```

<details>
<summary>Fallback: paste the SQL by hand</summary>

Open each file in `supabase/migrations/` **in filename order** and run it as its
own query in **SQL Editor → New query**, checking for "Success" after each. All
five are safe to re-run.
</details>

## Step 3 — Turn off email confirmation (recommended)

So you and Ely can sign up and be straight in:
**Authentication → Sign In / Providers → Email** → **Confirm email OFF** → **Save**.

## Step 4 — Grab your API keys

1. **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. Duplicate `.env.local.example`, rename the copy to `.env.local`, and fill it in:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...your anon key...
   ```

> **PowerShell warning:** don't create this file with `>`. PowerShell 5.1 writes
> UTF-16, which breaks `.env` parsing while looking perfect in Notepad. Use
> `Set-Content -Encoding ascii`.

Both of these are public by design — `NEXT_PUBLIC_*` is inlined into the client
bundle, and RLS is what protects the data. The **service_role** key is the real
secret and must never reach the client or the repo.

## Step 5 — Run it locally

```bash
npm install
npm run dev
```

Open **http://localhost:3000**. Create your account → pick a starting plan
(choose "Sean — Full Body + Pool") → you land on the tracker. Log a set to
confirm it sticks. 🎉

---

# PART 2 — Put it online (Vercel)

## Step 6 — Push the code to GitHub

```bash
git init
git add .
git commit -m "Streakproof"
git branch -M main
git remote add origin https://github.com/<your-username>/streakproof.git
git push -u origin main
```

## Step 7 — Import into Vercel

1. [vercel.com/new](https://vercel.com/new) → **Import** your `streakproof` repo.
2. **Confirm Framework Preset is `Next.js`.** This matters more than it looks —
   see the box below.
3. Expand **Environment Variables** and add the same two from `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`

   Scope them to **Production and Preview**.
4. **Deploy**.

> ### ⚠️ Framework Preset must be Next.js
>
> If the preset is **Other**, Vercel never runs the Next.js builder. The build
> still reports success, `public/` still serves, and middleware still gets
> bundled — but **no App Router page is deployed as a function**. What you get
> is `500: MIDDLEWARE_INVOCATION_FAILED` with `ReferenceError: __dirname is not
> defined` in the runtime logs (Node globals survive into a generically-bundled
> Edge function), and a bare `404: NOT_FOUND` on every route once middleware is
> out of the way.
>
> This cost an afternoon on 2 Aug 2026. Check it first if the deployed app
> misbehaves while `npm run build` is clean locally.
>
> Changing the preset does **not** fix existing deployments — they keep the
> config they were built with. Redeploy: **Deployments → ⋯ → Redeploy**.

## Step 8 — Point Supabase at your live URL

Supabase → **Authentication → URL Configuration** → set **Site URL** to your
Vercel URL → **Save**.

---

# PART 3 — Get it on your phones

## For you

1. Open your Vercel URL in your phone's browser (**Safari** on iPhone, **Chrome** on Android).
2. Sign in.
3. Add to home screen:
   - **iPhone (Safari):** **Share** → **Add to Home Screen** → **Add**.
   - **Android (Chrome):** **⋮** → **Add to Home screen** / **Install app**.

## For Ely

1. Send Ely the same Vercel URL.
2. He taps **Create account** and makes his own login.
3. He picks **"Ely — Planet Fitness Upper/Lower"** as his starting plan.
4. Home screen, same steps.

You each get your own login, your own copy of your plan, and your own history.

---

# How to use it

- **Today tab** — day tabs across the top (each showing its `~N min` estimate); tap one, log each set's weight and reps, tick it off. The bar fills as you go and a 🏆 shows when you beat a lift's best. Use the `‹ ›` arrows above the tabs to fill in a day you missed — the header turns gold and says "filling in".
- **⏱ button (bottom-right)** — rest-timer presets.
- **History tab** — every session you've logged.
- **Progress tab** — streak and totals, a weight-over-time chart, and your PR board.
- **Edit tab** — rename days, add/remove/reorder exercises, set the number of sets, edit form cues. Changes appear on Today immediately. If a save fails, a red banner appears with a **Retry** — nothing is silently dropped.

## Editing plans two ways

- **In the app:** the **Edit** tab. Easiest, no code.
- **In bulk / from code:** edit `supabase/tools/gen_seed.py` and run
  `npm run seed:gen`, which regenerates the template migration. If that
  migration has already been applied, write a **new** migration instead —
  `db push` tracks migrations by filename and won't re-run one it has seen.

---

## Commands

```bash
npm run dev          # local dev server
npm run build        # production build — must pass before any push
npx tsc --noEmit     # typecheck
npm test             # pure logic tests (dates, streaks). Needs Node 22.6+
npm run verify:db    # checks a live Supabase project has the schema loaded
npm run db:push      # apply new migrations
npm run seed:gen     # regenerate the template library migration
```

There's also a SQL harness in `supabase/tools/test/` that runs the whole schema
against stock Postgres and asserts on RLS, cloning, and the signed-out
boundary — see `docs/V2-CODE-CHANGES.md`.

---

## Troubleshooting

- **"Invalid login credentials"** right after signing up → email confirmation is still on. Do Step 3, or check your email.
- **`500: MIDDLEWARE_INVOCATION_FAILED`, or a `404` on every route** → Framework Preset. See the box in Step 7.
- **A page is blank / says not signed in** → Vercel env vars missing or misspelled. Re-check Step 7, then redeploy.
- **`npm run verify:db` says no templates are visible** → either the templates migration didn't run or the anon read policy is missing. Run `select count(*) from plans where is_template;` in the SQL editor — that bypasses RLS and tells you which.
- **App feels "asleep" on first open of the day** → free-tier Supabase pauses after ~1 week idle and wakes on the next visit.
- **`npm run build` warns about multiple lockfiles** → there's a stray `package-lock.json` in a parent directory and Turbopack picked that as the workspace root. Delete the stray one; the build is unaffected on Vercel either way.

## Notes

- Dates are stored in **your local timezone**, read from `profiles.timezone` and
  self-healing from the browser on first load. This was a real v1 bug: UTC dates
  filed a 9pm Eastern workout under tomorrow and corrupted streaks, "last time",
  and PR detection.
- The Edge entry point is `proxy.ts` — Next 16 renamed the `middleware` file
  convention. It must use a **relative** import for `./lib/supabase/middleware`,
  not the `@/` alias: Vercel bundles it separately from the app build and the
  alias fails there while compiling fine locally.
- Tailwind 4 is CSS-first. There is no `tailwind.config.ts` — the colour tokens
  live in the `@theme` block at the top of `app/globals.css`.
