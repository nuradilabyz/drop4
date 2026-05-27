/**
 * Supabase auth callback. Exchanges the `?code` (magic link / OAuth) for a
 * session, then redirects to `?next` (default home). Next 16 route handler.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only allow same-origin relative redirects.
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // In prod behind a proxy, prefer the forwarded host if present.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      if (isLocal || !forwardedHost) {
        return NextResponse.redirect(`${origin}${next}`);
      }
      const proto = request.headers.get("x-forwarded-proto") ?? "https";
      return NextResponse.redirect(`${proto}://${forwardedHost}${next}`);
    }
  }

  // No code or exchange failed.
  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
