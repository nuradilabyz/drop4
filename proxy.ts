/**
 * Next.js 16 Proxy (formerly middleware). Refreshes the Supabase auth session
 * cookie on navigation so Server Components always see a fresh session.
 *
 * This follows the documented `@supabase/ssr` "server client in middleware"
 * pattern, adapted to Next 16: the file is `proxy.ts`, the export is `proxy()`,
 * and the runtime is Node.js (no edge).
 */
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write refreshed cookies onto both the request (for downstream
          // handlers) and the outgoing response (for the browser).
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Touch the user to trigger a token refresh if needed. Do not run other logic
  // between createServerClient and getUser, per @supabase/ssr guidance.
  await supabase.auth.getUser();

  return response;
}

export const config = {
  matcher: [
    /*
     * Run on all paths except static assets and image optimization, so the
     * session cookie stays fresh across the app. API routes do their own auth.
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
