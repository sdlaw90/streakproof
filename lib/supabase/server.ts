import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server-side Supabase client.
 *
 * `cookies()` became async in Next 15, so this is async too and every caller
 * awaits it. Nothing else about the shape changed.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          // In Server Components `set` throws — that's fine, the middleware
          // refreshes the session cookie on every request instead.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            /* called from a Server Component — ignore */
          }
        },
      },
    }
  );
}
