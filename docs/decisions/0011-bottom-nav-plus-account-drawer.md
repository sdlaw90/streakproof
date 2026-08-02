# 0011 — Bottom nav for destinations, drawer for account

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

SquirreLingo (`sdlaw90/reactor-lang`) has no bottom nav at all: a right-edge
drawer, triggered by the avatar in the home header, *is* the navigation, with
back/home pills on inner pages. It works well there and the pattern was worth
lifting.

It doesn't transfer wholesale. Streakproof is used mid-set, one-handed, on a
phone, with a rest timer running. Putting `History` and `Progress` behind a
drawer costs two taps and a reach to the top of the screen for something the
user does between sets.

## Decision

Both, split by purpose:

- **Bottom nav — destinations you move between while using the app.** Home,
  Workout, History, Progress. Thumb-reachable, always visible.
- **Drawer — account and configuration.** Edit your plan, switch plan, food plan
  (coming), timezone, sign out. Triggered by the avatar at the top-right of
  home, exactly like SquirreLingo's.

`Edit` moved out of the bottom nav to make room for the Home/Workout split. It
belongs in the drawer regardless: editing your program is a settings action, not
somewhere you hop to between sets.

## Consequences

- Two navigation surfaces to keep coherent. The rule that prevents drift: if it
  changes what you're *looking at*, it's a tab; if it changes how the app is
  *set up*, it's in the drawer. Nothing appears in both.
- The drawer is `components/UserDrawer.tsx`, rebuilt in Tailwind 4 rather than
  ported — SquirreLingo uses inline style objects and a JS `theme.js` with no
  CSS custom properties, so there was no code to share, only a pattern.
- Three deliberate improvements on the original, all of which it lacks: the
  panel stays mounted and slides on `translate-x` so it animates **out** as well
  as in; it carries `role="dialog"`, `aria-modal`, focus-in on open and
  focus-restore to the trigger on close; and it locks body scroll while open.
- Following SquirreLingo's own hard-won rule (their issue #85): the drawer must
  never be the only path to anything. Everything in it is reachable another way.

## Alternatives considered

- **Full SquirreLingo mirror, drawer only.** Most faithful, and rejected for the
  one-handed mid-set case above.
- **Bottom nav duplicating the drawer's items.** Two competing systems, and no
  answer to "where does a new thing go?"
