# 0004 — Calorie tracking is an overlay, not a fork

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

Calorie and macro tracking is the feature most requested of any food app and the
one most likely to make this app hostile to its own users. Streakproof's
principles are additive-never-subtractive and no-decisions-at-the-point-of-need;
a mandatory logging surface violates both, and full nutrition data needs a source
the project doesn't have yet.

## Decision

Tracking is `plans.tracking_mode` — `none` | `protein` | `full` — an overlay on
the existing food tables. Nutrition columns on `food_items` are optional.
`tracking_mode` decides whether nutrition fields appear in the UI at all. Never
fork the schema for it.

## Consequences

- The default (`none`) is a food app with no numbers in it, which is the right
  default for the target user.
- `protein` is a real middle tier and matches progressive overload: add one
  upgrade at a time, only once the previous one is automatic.
- `full` is gated on a nutrition data source, still open. USDA FoodData Central
  and Open Food Facts are the free candidates; paid ones are better but priced
  per call.
- Every food query must tolerate null nutrition. That's the cost, and it's paid
  once in the loaders.

## Alternatives considered

- **Separate "tracking" tables** — a second write path for the same meal, and
  two sources of truth about what was eaten.
- **Tracking always on, hidden in the UI** — the schema stops being honest about
  what the product is, and the temptation to surface it grows.
