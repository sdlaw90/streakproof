// Next 16 renamed the `middleware` file convention to `proxy` — same Edge
// function, same `config.matcher`, the exported function is just named `proxy`
// now. Migrated with `npx @next/codemod@canary middleware-to-proxy .`.
import { type NextRequest } from "next/server";
// Deliberately a RELATIVE import, not the "@/" alias. Vercel bundles this Edge
// function separately from the app build, and an aliased import here fails
// there with "referencing unsupported modules" even though it compiles fine
// locally. Relative always resolves; "@/" is still fine everywhere else.
import { updateSession } from "./lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets.
     *
     * Note this does NOT exclude .txt / .json, so a request for a file that
     * doesn't exist (robots.txt, say) still runs this function. That's how the
     * 2 Aug 2026 outage first showed itself — a 500 on /robots.txt.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
