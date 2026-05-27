/**
 * Stripe Billing Portal session creator.
 *
 * Looks up the caller's `stripe_customer_id` (from `subscriptions`), creates a
 * billing-portal session, and redirects (303) the browser to it. Used by
 * `components/billing/ManageBillingButton`.
 *
 * Degrades gracefully: unconfigured Stripe or no customer on file → redirect to
 * `/pricing` with a flag rather than throwing. Both GET and POST are accepted.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe, isStripeConfigured } from "@/lib/stripe";

export const runtime = "nodejs";

function siteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
}

async function handle(_request: NextRequest): Promise<NextResponse> {
  const site = siteUrl();

  // ── Require an authenticated caller ─────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${site}/pricing?stripe=login`, 303);
  }

  if (!isStripeConfigured()) {
    return NextResponse.redirect(`${site}/pricing?stripe=unconfigured`, 303);
  }

  // ── Resolve the Stripe customer id ──────────────────────────────────
  let customerId: string | null = null;
  try {
    const admin = createAdminClient();
    const { data: sub } = await admin
      .from("subscriptions")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    customerId = sub?.stripe_customer_id ?? null;
  } catch {
    // fall through to no-customer handling
  }

  if (!customerId) {
    // Nothing to manage yet — point them at pricing to subscribe first.
    return NextResponse.redirect(`${site}/pricing?stripe=no_customer`, 303);
  }

  // ── Create the portal session ───────────────────────────────────────
  try {
    const stripe = getStripe();
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${site}/pricing`,
    });
    return NextResponse.redirect(session.url, 303);
  } catch {
    return NextResponse.redirect(`${site}/pricing?stripe=error`, 303);
  }
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
