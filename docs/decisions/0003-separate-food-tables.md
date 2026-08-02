# 0003 — The food side gets its own tables

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

Gym and food share a skeleton: a plan, units of work inside it, logs against
those units. The tempting move is to reuse `days` / `exercises` for meals with a
`kind` discriminator and some nullable columns.

Food doesn't actually fit. It needs quantities, optional nutrition fields, and —
the part that breaks the analogy — a **many-to-many** between reusable pantry
items and the builds that use them. An exercise belongs to exactly one day; a
chicken thigh belongs to four builds.

## Decision

The food side gets `food_items`, `builds`, `build_items`, `prep_sessions`,
`prep_tasks`, `meal_logs` and `prep_logs`. `plans` is shared, discriminated by
`kind` (`gym` | `food`). Don't merge the two sets of child tables.

## Consequences

- Both sides clone through the same `clone_plan()` and are covered by the same
  `owns_plan` / `can_read_plan` RLS helpers, so the shared part is genuinely
  shared.
- Two sets of loaders and two sets of screens. Accepted — they were going to
  diverge in the UI regardless, since a prep session is a checklist and a
  workout is a tracker.
- `builds.is_fallback` gives the food side its named bad-day option, the
  counterpart to the gym side's Pool day. Every plan needs a defined floor.

## Alternatives considered

- **One polymorphic child table with nullable columns** — the many-to-many kills
  it. You end up with a join table anyway, plus a table where half the columns
  are null for half the rows.
- **A separate app for food** — throws away auth, plans, RLS, review triggers
  and the AI builder, all of which are identical.
