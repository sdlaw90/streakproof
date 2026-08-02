# 0014 — The food UI mirrors the gym side, with two deliberate breaks

- **Status:** Accepted
- **Date:** 2026-08-03

## Context

The food schema and a seeded template have existed since v2 with no screens.
`docs/MEAL-FRAMEWORK.md` §2 maps the food side onto the gym side almost
one-for-one — rotation, a designed floor, never-miss-twice, log one number — so
the obvious move is to build the screens the same way.

Almost. Two things genuinely differ, and getting them wrong would have produced
a food app that fights how eating actually works.

## Decision

Mirror the gym side: `/food` is a rotation with a suggestion, `suggestBuild()`
sits beside `suggestDay()` as a pure function, and both are unit tested without
a database.

**Break 1 — prep sessions ARE weekday-bound, unlike workout days.** ADR 0010
deliberately refused to bind days to weekdays, because a plan that says "legs on
Tuesday" is broken by one missed Tuesday. Batch cooking is the opposite: it
happens *because* it's stapled to Sunday and to Wednesday-after-the-gym, when
you're already out and in motion (MEAL-FRAMEWORK §4). Remove the weekday and it
stops happening at all.

`prepDueOn()` carries the compromise: a session is `today` on its weekday,
`overdue` once that day has passed without it, `done` when done, and never
"wait until next Sunday" — because the answer to a missed prep session is
twenty minutes at the shop, not a lost week.

**Break 2 — free-text meals are first-class, not a fallback.** `meal_logs.name`
with a null `build_id` is a designed path with its own input on `/food`, not an
"other" bucket. Two breakfast burritos at noon is the brain solving the problem
correctly after five hours without food (MEAL-FRAMEWORK §4); a food app that
makes that feel like a failure is one people stop opening. The copy says so
explicitly: *nothing here is a cheat*.

Everything else follows the gym patterns: fallback builds excluded from the
rotation and surfaced separately under "Nothing prepped"; the rotation picks
whatever you've gone longest without, so the sauce carries the variety; no
nutrition anywhere, because `tracking_mode` defaults to `none` and that is the
point rather than a limitation.

## Consequences

- Two suggestion functions with the same shape. `suggestDay()` and
  `suggestBuild()` differ only in excluding fallbacks — worth keeping separate
  rather than generalising, because the next change to either is unlikely to
  apply to both.
- Prep progress is one row per (user, session, date) with an array of completed
  task ids, not a row per task. The interesting question is "did Sunday's prep
  happen", and a half-finished session is normal.
- The checklist ticks optimistically. Same reasoning as the set logger: this is
  used in a kitchen with wet hands, and a checkbox that waits on a round trip
  feels broken. The server action still decides, and a failure surfaces.
- `/setup/food` is a separate route from `/setup` rather than a `?kind=` param.
  The copy has to do different work — the gym picker sells structure, the food
  picker has to explain components-not-meals before anything else makes sense.
- Bottom nav is five tabs now. That's the ceiling; anything further goes in the
  drawer.

## Alternatives considered

- **One combined "today" screen.** Rejected: the gym side is used three times a
  week standing in a gym, the food side several times a day in a kitchen. Same
  screen, different hands, different urgency.
- **Weekday-bound builds, like a meal plan.** That's the five-identical-Tupperware
  failure in schedule form. The rotation exists precisely so nothing is
  scheduled.
- **Nutrition fields on by default.** `tracking_mode` already answers this —
  see [ADR 0004](0004-tracking-mode-overlay.md).
