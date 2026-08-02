# 0013 — The seed generator holds its own data

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

`supabase/tools/gen_seed.py` imported the v1 generator from
`supabase/gen_seed.py` at module load, to reuse the gym exercise text. In
`628d992` that file was deleted as a "v1 leftover" during a docs tidy-up.

It wasn't a leftover — it held the exercise names, schemes and coaching cues for
both gym templates. `npm run seed:gen` has raised `FileNotFoundError` on every
invocation since. Nobody noticed because the template migration was already
applied and nothing re-ran the generator for a month.

Discovered while adding three new templates, which is the first thing that
needed it.

## Decision

The generator holds its own data. `PROGRAMS` and `set_count()` are inlined into
`supabase/tools/gen_seed.py`, the cross-file import is gone, and there is no
second generator. A `--only <slugs>` flag emits a subset, which is what makes a
delta migration possible now that the original template migration is applied and
immutable.

## Consequences

- One file to edit, and it runs. Verified by regenerating the existing migration
  and diffing: the two original gym templates come out **byte-identical** to
  what is applied in production, which is what makes the repair trustworthy
  rather than merely plausible.
- The SQL harness now asserts the **exact set** of template slugs rather than a
  count, plus that every gym template has days, exercises and duration
  estimates. A count-based assertion would have let a template silently vanish;
  a "3 or more" assertion would have been worse.
- Adding a template means editing the generator and adding a row to the harness'
  expected list. That's deliberate friction — the test should fail when the
  library changes without anyone saying so.

The wider lesson, and the reason this is an ADR rather than a commit message:
**deleting something because it looks like an artefact of a previous version is
how you delete something load-bearing.** The tell was available — the import
would have failed immediately — but nothing ran it. Generated artefacts hide
their generators' breakage for exactly as long as nobody regenerates.

## Alternatives considered

- **Restore `supabase/gen_seed.py`.** Puts back a file whose only purpose was v1
  compatibility, and keeps a fragile path-based import across directories.
- **Hand-write the new template migration.** Would have worked once and left the
  generator broken for the next person, which is how this happened in the first
  place.
