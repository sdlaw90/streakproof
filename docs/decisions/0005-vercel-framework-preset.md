# 0005 — Vercel Framework Preset must be `Next.js`

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

Every route in production returned `500 MIDDLEWARE_INVOCATION_FAILED`, with
`ReferenceError: __dirname is not defined` in the runtime logs, while
`npm run build` was clean locally. It read as a continuation of an earlier Edge
middleware build failure — which had a real, separate, already-fixed cause (the
`@/` alias in `middleware.ts`).

The actual cause was the Vercel project's **Framework Preset set to `Other`**.
Under `Other`, Vercel never runs the Next.js builder. The build still reports
success, `public/` is still served, middleware is bundled generically — which is
how a Node global like `__dirname` survives into an Edge function — and **no App
Router page is deployed as a function at all**. With middleware neutralised on a
probe branch, every route returned a bare `404`.

Cost: an afternoon.

## Decision

The Vercel project (`adhd90` / `streakproof`) must have Framework Preset =
`Next.js` under Settings → Build and Deployment. This is checked as part of
[docs/RELEASING.md](../RELEASING.md), and it is the **first** suspect whenever
production misbehaves while a local build is clean.

Related: `proxy.ts` must use relative imports, not the `@/` alias — Vercel
bundles it separately from the app build and the alias fails there while
compiling fine locally.

## Consequences

- Platform configuration is now treated as part of the system's state even
  though it lives outside the repo, and it cannot be verified from a code
  review.
- Changing a project setting does **not** affect existing deployments — they
  keep the config they were built with. Any settings change requires a redeploy
  to take effect.
- The general rule, worth more than the specific fact: **a green build is not
  evidence that the right builder ran.** Check the platform config before
  suspecting the code.

Ruled out during the investigation and not worth re-investigating: environment
variables, build cache, and the app's own dependency graph.

## Alternatives considered

- **Pinning the build with `vercel.json`** — would make the config
  repo-visible and reviewable. Not done yet; worth revisiting, since it would
  have made this failure impossible rather than merely documented.
