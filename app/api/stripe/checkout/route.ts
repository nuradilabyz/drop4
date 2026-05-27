/**
 * Stripe Checkout session creator.
 *
 * Reads `?price=pro_monthly|pro_yearly|team_monthly`, requires an authenticated
 * caller (server session), creates a subscription-mode Checkout Session, and
 * redirects (303) the browser to Stripe's hosted page.
 *
 * Degrades gracefully: if Stripe (or the relevant price id) is unconfigured —
 * the dev default — it redirects to `/pricing?stripe=unconfigured` instead of
 * throwing. Unauthenticated callers are bounced to the login page.
 *
 * Both GET (link click from the pricing page) and POST (CheckoutButton) work.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStripe,
  isStripeConfigured,
  isPriceKey,
  priceIdFor,
} from "@/lib/stripe";

export const runtime = "nodejs";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

async function handle(request: NextRequest): Promise<NextResponse> {
  const site = siteUrl();
  const priceParam = request.nextUrl.searchParams.get("price");

  // ── Validate the requested price slug ───────────────────────────────
  if (!isPriceKey(priceParam)) {
    return NextResponse.redirect(`${site}/pricing?stripe=bad_price`, 303);
  }

  // ── Require an authenticated caller ─────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // No login page is owned by this agent; bounce back to pricing with a flag
    // the page can surface ("sign in to upgrade"). Keeps to a route that exists.
    return NextResponse.redirect(`${site}/pricing?stripe=login`, 303);
  }

  // ── Stripe / price configured? (empty in dev) ───────────────────────
  const priceId = priceIdFor(priceParam);
  if (!isStripeConfigured() || !priceId) {
    return NextResponse.redirect(`${site}/pricing?stripe=unconfigured`, 303);
  }

  // ── Resolve a profile username for a nice success_url ───────────────
  let username = "me";
  let existingCustomerId: string | undefined;
  try {
    const admin = createAdminClient();
    const [{ data: profile }, { data: sub }] = await Promise.all([
      admin.from("profiles").select("username").eq("id", user.id).maybeSingle(),
      admin
        .from("subscriptions")
        .select("stripe_customer_id")
        .eq("user_id", user.id)
        .maybeSingle(),
    ]);
    if (profile?.username) username = profile.username;
    if (sub?.stripe_customer_id) existingCustomerId = sub.stripe_customer_id;
  } catch {
    // Non-fatal: fall back to "me" and let Stripe create a customer.
  }

  // ── Create the Checkout Session ─────────────────────────────────────
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: user.id,
      // Reuse an existing customer if we have one; else key by email so Stripe
      // de-dupes. We also stash user_id in metadata for webhook resolution.
      ...(existingCustomerId
        ? { customer: existingCustomerId }
        : user.email
          ? { customer_email: user.email }
          : {}),
      metadata: { user_id: user.id, price_key: priceParam },
      subscription_data: { metadata: { user_id: user.id } },
      allow_promotion_codes: true,
      success_url: `${site}/profile/${encodeURIComponent(username)}?upgraded=1`,
      cancel_url: `${site}/pricing`,
    });

    if (!session.url) {
      return NextResponse.redirect(`${site}/pricing?stripe=error`, 303);
    }
    return NextResponse.redirect(session.url, 303);
  } catch {
    // Never 500 the user into a dead end — bounce back to pricing.
    return NextResponse.redirect(`${site}/pricing?stripe=error`, 303);
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
