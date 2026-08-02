# 0016 — Ask about taste and allergies before offering a plan

- **Status:** Accepted
- **Date:** 2026-08-03

## Context

Food setup opened on a single template card — "Bowl Rotation — Asian & Latin,
tap to start" — which asks someone to accept a rotation of another person's four
flavours before the app has asked them anything at all.

Two things make that wrong rather than merely unpolished:

- **The sauce carries the variety** (MEAL-FRAMEWORK §3). The base is
  deliberately boring; the flavour axis is the entire mechanism that stops a
  plan dying by Wednesday. Guessing it is guessing the one thing that matters.
- **A plan containing something you're allergic to isn't a plan.** Offering it
  first and letting the user discover the problem later is backwards.

## Decision

`/setup/food` asks two questions before showing any plan: which cuisine
families you want, and what you can't eat. Answers go to `builder_profiles`
with `kind = 'food'` — the same table the gym intake uses, one row per user per
kind.

The intake is stored against the **person, not the plan**. Re-picking a template
later must not mean re-declaring an allergy.

Declared allergens then flag matching pantry items — on the template card before
you choose it, and in the food editor afterwards.

## Consequences

- **Flagging is a hint, and the UI says so in those words.** `flagAllergens()`
  matches substrings in a name someone typed. It cannot read a label, cannot
  know a jarred sauce contains fish, and will miss things. Every place it
  appears carries the same line: *check anything you're allergic to yourself*.
  The function's own doc comment says the same, so nobody wires it into
  something that silently filters.
- **Biased toward false positives, within reason.** Flagging soy sauce for a
  wheat allergy is a mild annoyance; missing it is not. But a bare `soy` keyword
  under wheat would flag tofu and edamame — both gluten-free — and a flag that
  cries wolf stops being read. The keyword lists are tuned to that line, and the
  unit tests pin both directions: soy sauce flags wheat, jasmine rice flags
  nothing.
- The unit tests earned their keep immediately. `soy sauce` as a literal keyword
  failed against the seeded pantry's actual name, "Soy-ginger-garlic sauce" —
  exactly the kind of gap that would otherwise have shipped as silent
  under-flagging.
- Cuisines are recorded but nothing consumes them yet; there's one seeded food
  template. They exist for the generator, which is the point — it can't build a
  rotation without knowing which four flavours to build it from.
- `avoidNote` and `favouritesNote` are free text on purpose. Food doesn't
  enumerate the way gym equipment does — "sushi, pho, Bolay" would never appear
  in a checkbox set (MEAL-FRAMEWORK §6).

## Alternatives considered

- **Filter allergens out of the cloned plan automatically.** Rejected, and this
  is the important one: silently removing ingredients would imply the result is
  safe to eat. It isn't, and no amount of substring matching makes it so. The
  user decides; the app points.
- **Ask allergies only, skip cuisines.** Loses the thing that actually decides
  whether the plan survives contact with a Wednesday.
- **Put the intake inside `/build` like the gym one.** The gym intake feeds a
  generator that doesn't exist yet; this one has to work today, so it sits in
  the setup path where a plan is actually chosen.
