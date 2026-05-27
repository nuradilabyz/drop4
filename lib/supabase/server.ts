/**
 * Server-side Supabase client for Server Components, Route Handlers, and
 * Server Actions. Reads/writes the session via Next 16's **async** `cookies()`.
 *
 * Always create a fresh client per request — never cache across requests.
 */
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export async function createClient() {
  // Next.js 16: cookies() is async — must be awaited.
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // `setAll` was called from a Server Component, where setting cookies
            // is not allowed. This is safe to ignore when proxy.ts refreshes the
            // session on navigation (the documented @supabase/ssr pattern).
          }
        },
      },
    },
  );
}
