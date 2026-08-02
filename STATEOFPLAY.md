# Streakproof — state of play

Written 2 Aug 2026, at the point of switching to a project with direct access to
the local folder. Everything a fresh session needs to pick this up cold.

---

## 1. What this is and where it came from

It started as a question about ADHD-friendly meal prep, using an existing gym
plan as a structural model. That went: gym plan → meal framework → "we already
made the gym plan into an app" → the app should hold both → the app should build
plans with AI → the app might go public.

The through-line: **the failure mode isn't motivation, it's decisions made while
depleted.** A good program works because the choosing already happened. Food
fails because the choice lands at 7pm when you're empty and DoorDash is one
thumb away. Everything in the product exists to move decisions upstream and to
survive the days that go wrong.

The design principles that came out of that are in `CLAUDE.md` and are load
bearing — they're why the schema looks the way it does.

## 2. Naming

Chosen: **Streakproof**. Tagline: *Workouts and meal prep for ADHD brains. Miss
a day — the plan survives.*

Positioning is explicit about ADHD — Sean's call, and it's the wedge: every
other fitness app assumes discipline to spare and is built on streaks that
punish a missed day. Rejected along the way: Reroll and Respec (too oblique),
Rotation and Prepped (too generic), Preset, Plates, Bumpers, Low Bar, Assist
Mode, Comeback, Easy Mode.

`streakproof.vercel.app` was taken; the deploy is `streakproof-app.vercel.app`.
A real domain is an open question for if/when it goes public.

## 3. The meal framework (not yet built as UI)

This is the design the food schema and seed template encode. It matters more
than the table shapes.

- **Components, not meals.** Batch two proteins, a base, some veg; assemble in
  five minutes. Identical Tupperware for five days is why meal prep dies by
  Wednesday.
- **The sauce carries the variety.** One base, four sauces = four meals for
  eleven extra seconds of work.
- **Sean's actual rotation:** Asian (soy-ginger / peanut / gochujang), Latin
  (chipotle-lime / salsa verde), tikka masala from a jar with naan, and
  pho/ramen-style broth bowls. Asian first, Latin close second.
- **Bolay is already the model** — base, protein, veg, sauce. He eats there
  voluntarily, which makes it a proven format and a legitimate on-plan
  restaurant when nothing's prepped.
- **Every favourite food is written in by name.** Nothing is a "cheat."
- **The real gap:** everything he likes is bought, not had. The system's job is
  getting three or four of those into the fridge.
- **Two prep sessions**, Sunday and Wednesday after the gym (Thursday doesn't
  work — not enough time between end of work and DnD).
- **A named four-minute fallback**, because "nothing prepped" is what actually
  ends these systems.
- **He forgets to eat** — first meal often around midday. So: two anchored meals
  rather than three, arm's-reach protein needing zero assembly, and eating
  stapled to things that already happen (post-gym Mon/Wed/Fri).

## 4. What the app was, and what changed

v1 was a working two-person tracker: per-set logging, PR badges, streaks,
progress chart, history, rest timer, in-app program editor, PWA, RLS. Solid
foundation — but with four problems that would have bitten immediately and one
that blocked the whole roadmap.

**The blocker:** `profiles.program_id` was a single column, and programs were
*claimed* — the first user to pick one owned it forever, and nobody else could
use it. That made meals impossible (nowhere to put a second plan) and sharing
impossible.

**v2 replaced it with copy-on-select.** Plans are templates (unowned) or plans
you own; picking a template calls `clone_plan()` and copies it. Profiles hold
one active plan per `kind` (`gym` | `food`). The AI builder becomes cheap
architecturally, because a generated plan is just another producer of the shape
a template already has.

**The four deploy-blockers, all fixed:**

1. **UTC dates.** Evening lifts in Eastern time were filed under tomorrow.
   Now local, from `profiles.timezone`, self-healing from the browser.
2. **Today-only logging.** Now backfillable via `?date=`, guarded server-side.
3. **Fixed set counts.** A fourth set had nowhere to go. Now variable.
4. **Silent save failures.** Writes were fired and forgotten on gym wifi. Now
   surfaced per-row with retry.

Also rewritten: **"never miss twice"** was a static line of text at 3+ days
regardless of how often you train. It now compares against the user's own median
gap, so a weekly lifter isn't nagged on day three.

## 5. Where things stand

**Done and verified**

- v2 schema live in Supabase — 16 tables, RLS throughout, `clone_plan()`,
  duration estimates, three seeded templates (2 gym, 1 food).
- Migrations are CLI-pushable (`supabase db push`), not copy-paste.
- App code fully on v2; build and typecheck clean.
- `npm test` — 16 assertions on date and streak logic, including the exact UTC
  bug.
- SQL harness — 14 assertions on RLS, cloning, and the anon boundary, run
  against real Postgres in migration order.
- Repo on GitHub, deployed to Vercel, environment variables set.

**In flight**

- Edge middleware build failure on Vercel (`@/` alias unresolved in the Edge
  bundler). Fix committed — relative import — but **not yet confirmed deployed**.
  This is the one open thread.

**Not started**

| | Why it matters |
|---|---|
| **Next 16 upgrade** | 14.2.35 carries 21 advisories. Fine for two private users, not fine public. Breaking: `cookies()`, `params`, `searchParams` became async — touches `lib/supabase/server.ts` and two pages. ~30 min. |
| **Review triggers** | Time / stalled / adherence / season checks writing to `plan_reviews`. Smallest remaining piece and it's the loop that makes the AI builder worth having. |
| **Food UI** | Schema and template exist; no screens. Makes the app daily rather than 3×/week. |
| **AI builder** | The differentiator. Design agreed (below). |
| **CI for migrations** | GitHub Action running `db push` on merge to `main`. Sean already added secrets in anticipation. |

## 6. AI builder — agreed design, not yet built

- **Structured intake stored as a profile**, not a throwaway prompt.
  `builder_profiles` (jsonb, one row per user per kind). Same data drives
  generation, regeneration, and the review flow.
- **One generation call returning validated JSON**, inserted through the same
  path a template clone uses. The model never writes SQL and never renders
  unvalidated text.
- **Refinement as scoped diffs**, not open chat — "swap the squats, my knee
  hurts" returns an edit to one day. Cheap, bounded, and where users feel the
  intelligence.
- **One-tap presets in front of the form**, because a meaningful share of users
  won't complete a form at all.
- **Food needs more free text than gym.** Gym inputs enumerate (equipment, days,
  minutes). Food doesn't — "sushi, pho, Bolay" would never appear in a checkbox
  set. Parse free text into tags.
- **Cost and safety before public:** rate limits, cached generations, capped
  regenerations, a hard floor on calorie targets, no aggressive-cut presets, an
  age gate, and a refusal path for medical questions. `ai_generations` exists to
  make the first three possible and is deliberately not client-writable.

## 7. Open questions

- Real domain, if this goes public.
- Nutrition data source for `tracking_mode: 'full'` — USDA FoodData Central and
  Open Food Facts are the free options; paid ones are better but per-call.
- Whether the food side gets its own bottom-nav section or interleaves with the
  gym one.
- Whether Ely is a second user of a private app or the first test of a public
  one.

## 8. Lessons worth not relearning

- **Verification that can't fail isn't verification.** `verify-db` twice
  reported success against a database with no schema — first because it only
  matched Postgres' `42P01` and not PostgREST's `PGRST205`, then because it
  queried templates as a signed-out user when the read policy was
  `TO authenticated`. Both times the tooling was more confident than correct.
- **Mirror production in the test harness.** The local Supabase stub granted
  table privileges to `authenticated` but not `anon`, so anon failed with
  "permission denied" instead of the empty result a real project returns —
  which is exactly what hid the second bug.
- **Hand off runnable things, not instructions.** Four SQL files that had to be
  pasted into a web console by hand got skipped entirely, and reasonably so.
  Migrations fixed it.
- **PowerShell isn't bash.** `printf` doesn't exist, and `>` writes UTF-16 that
  breaks `.env` files while looking perfect in Notepad.
