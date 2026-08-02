import { type NextRequest } from "next/server";
// Deliberately a RELATIVE import, not the "@/" alias. Vercel bundles the Edge
// middleware separately from the app build, and an aliased import here fails
// there with "referencing unsupported modules" even though it compiles fine
// locally. Relative always resolves; "@/" is still fine everywhere else.
import { updateSession } from "./lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static assets.
     */
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
