# 0010 — Home is a summary, and the day is suggested rather than scheduled

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

Opening the app landed you directly in the set logger: a grid of empty weight
and rep inputs, with day tabs across the top and no context. The first thing the
product ever showed you was a decision — *which day is this?* — asked at the
exact moment the user is least equipped to answer it. That is the failure mode
the whole app exists to remove.

Underneath it sits a second problem. Days are a rotation (`A` / `B` / `C` /
`P`), and nothing in the schema binds a day to a weekday. That's deliberate — a
plan that says "legs on Tuesday" is broken by one missed Tuesday, and
forgiveness-not-streaks means a missed day cannot cascade. But it left the
question of *which day is today* unanswered, so the logger just opened on
whichever day happened to sort first.

## Decision

`/` is a summary screen: date, greeting, the "never miss twice" nudge when it
applies, a suggested session, the food plan's state, and three headline stats.
The set logger moves to `/workout`, reached from home's call to action or the
`Workout` tab, and accepts `?day=<key>` so home can hand off its suggestion.

The suggestion is `suggestDay()` in `lib/suggest.ts`: **the day you're most due
for.** A day never done wins outright, in `sort` order, so a fresh plan starts
at day one. Otherwise it's whichever day was done longest ago, ties broken by
`sort` so the rotation keeps its intended shape.

## Consequences

- The app decides, and the user confirms. "Pick a different day" is one tap
  below the CTA, so the suggestion is never a cage.
- Missing a day cannot desynchronise anything, because there was never a
  schedule to fall out of step with. Skip Wednesday and Wednesday's session is
  simply the one you're most due for on Thursday.
- Backfilling doesn't confuse it: only sessions with a checked-off set count as
  done, so an opened-but-empty session doesn't rotate the suggestion away.
- `suggestDay()` and `greetingFor()` are pure and unit tested, like the rest of
  `lib/`. Eleven assertions cover the tie-break, the never-done case and the
  empty plan.
- Home is one more page load before training. Accepted: it replaces a decision
  with a tap, which is the trade this product exists to make.
- Anything that later wants real scheduling (a prep session on Sundays, say)
  needs its own mechanism. Don't add a weekday column to `days`.

## Alternatives considered

- **Bind days to weekdays.** Simplest to explain and the standard approach.
  Rejected: it manufactures the "you missed leg day" guilt the product is built
  to avoid, and a two-day slip silently reorders the whole week.
- **Strict round-robin from the last session.** Cheap, but wrong after a gap —
  it would insist on day B in the order regardless of the fact that C hasn't
  been touched in three weeks.
- **Keep the logger on `/` and add a header.** Doesn't fix anything. The decision
  is still being asked at the point of need, just with more chrome around it.
