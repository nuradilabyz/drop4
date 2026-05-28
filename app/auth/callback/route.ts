/**
 * Supabase auth callback. Exchanges the `?code` (magic link / OAuth) for a
 * session, then redirects to `?next` (default home). For the very first
 * confirm of a fresh account we tack `welcome=1` on so the landing pops a
 * one-shot toast; on every subsequent sign-in we redirect silently — a
 * "Welcome aboard" greeting for a returning user reads as cargo-culted
 * nonsense. Next 16 route handler.
 */
import { NextResponse, type NextRequest } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Add `welcome=1` to whatever path we're sending the user to, preserving
 *  any query they already had. */
function withWelcome(path: string): string {
  const [pathname, query = ""] = path.split("?", 2);
  const params = new URLSearchParams(query);
  params.set("welcome", "1");
  return `${pathname}?${params.toString()}`;
}

/** Is this `exchangeCodeForSession` completing a brand-new signup, or is it
 *  a returning user reusing the magic-link flow as their primary sign-in?
 *  On the FIRST confirm Supabase stamps `last_sign_in_at` at nearly the same
 *  instant as `created_at`; later sign-ins drift `last_sign_in_at` forward
 *  while `created_at` stays put. We use a generous 2-minute window to absorb
 *  clock skew and slow email delivery. */
function isFirstSignIn(user: User | null | undefined): boolean {
  if (!user?.created_at || !user?.last_sign_in_at) return false;
  const created = Date.parse(user.created_at);
  const lastSignIn = Date.parse(user.last_sign_in_at);
  if (!Number.isFinite(created) || !Number.isFinite(lastSignIn)) return false;
  return Math.abs(lastSignIn - created) < 120_000;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only allow same-origin relative redirects.
  const nextParam = searchParams.get("next");
  const next = nextParam && nextParam.startsWith("/") ? nextParam : "/";

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const target = isFirstSignIn(data?.user) ? withWelcome(next) : next;
      // In prod behind a proxy, prefer the forwarded host if present.
      const forwardedHost = request.headers.get("x-forwarded-host");
      const isLocal = process.env.NODE_ENV === "development";
      if (isLocal || !forwardedHost) {
        return NextResponse.redirect(`${origin}${target}`);
      }
      const proto = request.headers.get("x-forwarded-proto") ?? "https";
      return NextResponse.redirect(`${proto}://${forwardedHost}${target}`);
    }
  }

  // No code or exchange failed.
  return NextResponse.redirect(`${origin}/?auth_error=1`);
}
