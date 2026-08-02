# Releasing

All commands are **PowerShell**, run from `C:\Users\sean\Documents\streakproof`.
No `printf`, no `export`, no heredocs. Use `Set-Content -Encoding ascii` for any
file write — PowerShell 5.1 defaults to UTF-16 and silently breaks `.env` files
while looking perfect in Notepad.

---

## Every push to `main`

`main` auto-deploys to production. There is no staging environment, so this list
is the only gate.

If the change touched code — anything outside `*.md` — all three must pass
before pushing. A docs-only commit skips them; a gate that gets routinely
ignored stops being a gate.

```powershell
npx tsc --noEmit      # typecheck
npm run build
npm test              # date + streak logic. Needs Node 22.6+
```

If the change touched the schema:

```powershell
npm run db:push
npm run verify:db
```

Then:

- [ ] `CHANGELOG.md` — entry added under `## [Unreleased]`, in the right
      subsection (`Added` / `Changed` / `Removed` / `Fixed` / `Security`).
- [ ] Migration? Row added to `docs/MIGRATIONS.md` and a `### Database` note in
      the changelog entry.
- [ ] Expensive-to-reverse or non-obvious decision? ADR written in
      `docs/decisions/` and linked from the changelog entry.
- [ ] `STATEOFPLAY.md` still true. It states the current head commit — update it.

## Cutting a release

1. **Decide the bump.** For this project "public API" means the database schema
   and user-facing behaviour:
   - **major** — a migration needing manual intervention, or anything that
     breaks existing plans or logs
   - **minor** — a new capability, a new table, a backwards-compatible migration
   - **patch** — fixes, dependency bumps, copy, styling, docs

2. **Move `Unreleased` to a version heading** in `CHANGELOG.md` with today's
   date, add a fresh empty `## [Unreleased]`, and update the compare links at
   the bottom of the file.

3. **Bump and tag.** `npm version` writes `package.json`, commits, and tags in
   one step:

   ```powershell
   npm version minor -m "Release v%s"
   git push origin main --follow-tags
   ```

4. **Watch the deploy** in Vercel (team `adhd90`, project `streakproof`) and
   load `https://streakproof-app.vercel.app` — not just the build log. A green
   build is not evidence that the right builder ran.

5. **Smoke test in the running app**, not in a build: sign in, log a set, step
   back a day with `‹`, confirm the fields are empty, edit the program and save.

## When production misbehaves but the local build is clean

Check the platform config **before** the code. In order:

1. **Vercel → Settings → Build and Deployment → Framework Preset is `Next.js`.**
   With `Other`, the build reports success, `public/` still serves, and no App
   Router page is deployed at all. Symptoms: `500
   MIDDLEWARE_INVOCATION_FAILED` on everything, or a bare `404` on every route
   if middleware is out of the way. See
   [ADR 0005](decisions/0005-vercel-framework-preset.md).
2. **Did you change a project setting and not redeploy?** Existing deployments
   keep the config they were built with.
3. **Environment variables present** for the right environment.
4. **`proxy.ts` uses relative imports**, not the `@/` alias — Vercel bundles it
   separately and the alias fails there while compiling fine locally.

Only then start reading application code.

## Known non-blockers

- **`npm audit` reports 3 advisories.** All three are inside Next's own vendored
  `postcss` and `sharp`. `npm audit fix --force` "resolves" them by installing
  Next 9.3.3. They stay until Next ships a patch.
- **Turbopack warns about multiple lockfiles.** It picks the workspace root by
  walking up for lockfiles, so a stray `package-lock.json` in a parent directory
  (`C:\Users\sean\`, say) wins. Harmless on Vercel, which only ever sees the
  repo. Delete the stray file rather than pinning `turbopack.root` around it.
