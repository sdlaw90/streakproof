# 🔁 Streakproof

A private workout tracker for two people (you + Ely). Each person logs in, sees
their own program, logs every set (weight × reps), and it all **persists and
syncs** across devices. Includes streaks, personal records, progress charts, a
rest timer, and in-app program editing — so you never have to touch code again
after setup.

**Stack:** Next.js (App Router) · Supabase (Postgres + Auth) · Tailwind · deploys on Vercel. Everything fits the free tiers.

---

## Features

- **Per-set logging** — weight × reps for each set, with a "last time" reference under every exercise
- **Personal records** — automatic 🏆 PR badge when you beat your best on a lift
- **Streaks & stats** — week streak, workouts this week, all-time count, and a "never miss twice" nudge
- **Progress charts** — weight-over-time per exercise
- **History** — every past session with the numbers you hit
- **Rest timer** — floating timer with 60/90/120/180s presets, buzzes when done
- **In-app program editor** — add / edit / reorder / delete days and exercises, no SQL
- **Installable (PWA)** — add to your phone's home screen; works like a native app
- **Private by design** — row-level security means you only ever see your own data

---

# PART 1 — One-time setup (do this once, on a computer)

You'll need [Node.js](https://nodejs.org) 18+ installed, plus your existing
GitHub, Vercel, and Supabase accounts.

## Step 1 — Create the Supabase project
1. Go to the [Supabase dashboard](https://supabase.com/dashboard) → **New project**.
2. Name it `streakproof`, set a database password (save it somewhere), pick the region closest to you.
3. Wait ~2 minutes for it to finish provisioning.

> Keeping this separate from Squirrelingo is deliberate — nothing you do here can ever affect that app.

## Step 2 — Create the database tables

Use the **v2** schema in `supabase/v2/`. Run the four files **in order**, each as
its own query in **SQL Editor → New query**:

| # | File | What it does |
|---|------|--------------|
| 1 | `supabase/v2/01_schema.sql` | Tables |
| 2 | `supabase/v2/02_functions.sql` | `clone_plan()`, duration estimates, RLS helpers |
| 3 | `supabase/v2/03_rls.sql` | Row-level security policies |
| 4 | `supabase/v2/04_seed.sql` | The template library (2 gym plans + 1 meal plan) |

Each should report "Success". All four are safe to re-run.

> `supabase/schema.sql` and `supabase/seed.sql` are **v1**, kept for reference —
> don't run them. Since nothing was ever deployed, v2 is a fresh install rather
> than a migration. See `docs/V2-CODE-CHANGES.md` for what changed and why.

## Step 3 — Turn off email confirmation (recommended)
So you and Ely can sign up and be straight in, no confirmation email:
**Authentication → Sign In / Providers → Email** → toggle **Confirm email OFF** → **Save**.

## Step 4 — Grab your API keys
1. **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. In this project folder, duplicate `.env.local.example`, rename the copy to `.env.local`, and fill it in:
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGci...your anon key...
   ```

## Step 5 — Run it locally to make sure it works
In a terminal, from this folder:
```bash
npm install
npm run dev
```
Open **http://localhost:3000**. Create your account (name, email, password) →
you'll be asked to **pick your program** (choose "Sean — Full Body + Pool") →
you land on the tracker. Log a set to confirm it sticks. 🎉

---

# PART 2 — Put it online (Vercel)

## Step 6 — Push the code to GitHub
From this folder:
```bash
git init
git add .
git commit -m "Gym tracker"
git branch -M main
git remote add origin https://github.com/<your-username>/streakproof.git
git push -u origin main
```
(Create the empty `streakproof` repo on GitHub first if you haven't.)

## Step 7 — Import into Vercel
1. [vercel.com/new](https://vercel.com/new) → **Import** your `streakproof` repo. It auto-detects Next.js.
2. Expand **Environment Variables** and add the same two from your `.env.local`:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Click **Deploy**. After a minute you'll get a URL like `https://streakproof-xxx.vercel.app`.

## Step 8 — Point Supabase at your live URL
Back in Supabase → **Authentication → URL Configuration** → set **Site URL** to
your Vercel URL → **Save**. (Keeps auth working correctly in production.)

---

# PART 3 — Get it on your phones

Do this once each, on each phone.

## For you
1. Open your Vercel URL in your phone's browser (**Safari** on iPhone, **Chrome** on Android).
2. Sign in with the account you already made.
3. Add it to your home screen so it feels like an app:
   - **iPhone (Safari):** tap the **Share** icon → **Add to Home Screen** → **Add**.
   - **Android (Chrome):** tap the **⋮** menu → **Add to Home screen** / **Install app**.
4. Tap the new **Gym** icon on your home screen. Done — full-screen, no browser bar.

## For Ely
1. Send Ely the **same Vercel URL** (text, WhatsApp, whatever).
2. He opens it in his phone browser → taps **Create account** → makes his own login.
3. He picks **"Ely — Planet Fitness Upper/Lower"** as his program.
4. He adds it to his home screen using the same steps above.

That's it. You each have your own login, your own program, and your own history —
same app, fully separate data.

---

# How to use it

- **Today tab** — your day tabs across the top; tap one, then log each set's weight and reps and tick it off. The bar fills as you go, and a 🏆 shows when you beat a lift's best.
- **⏱ button (bottom-right)** — tap for rest-timer presets; it buzzes/beeps when time's up.
- **History tab** — every session you've logged, with the numbers.
- **Progress tab** — your streak and totals up top, a weight-over-time chart (pick any exercise), and your PR board.
- **Edit tab** — change your program: rename days, add/remove/reorder exercises, set the number of sets, edit form cues. Changes appear on Today immediately.

## Editing programs two ways
- **In the app:** the **Edit** tab (easiest — no code).
- **In bulk / from code:** edit `supabase/gen_seed.py`, run `python3 gen_seed.py > seed.sql`, and paste the new `seed.sql` into the Supabase SQL editor (it's safe to re-run).

---

## Troubleshooting

- **"Invalid login credentials"** right after signing up → email confirmation is still on. Do Step 3, or check your email for the confirm link.
- **A page is blank / says not signed in** → your Vercel env vars are missing or misspelled. Re-check Step 7, then redeploy.
- **Edits on the Edit tab don't stick** → only the program's owner can edit. Whoever first selects a program becomes its owner, so make sure you selected "Sean —…" on your account and Ely selected "Ely —…" on his.
- **App feels "asleep" on first open of the day** → free-tier Supabase pauses after ~1 week idle and wakes on the next visit; just give it a few seconds.

## Notes
- "Today" is based on UTC. If you train right around midnight your local time and want the date pinned to your timezone, it's a one-line tweak in `app/actions.ts` and `app/page.tsx`.
- Want more later (body-weight tracking, notes per session, sharing a workout with each other, dark/light toggle)? All straightforward additions on this foundation.
