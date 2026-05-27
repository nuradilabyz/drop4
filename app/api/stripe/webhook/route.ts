/**
 * Stripe webhook receiver. SERVER-ONLY, runtime "nodejs".
 *
 * Verifies the signature against STRIPE_WEBHOOK_SECRET using the RAW request
 * body (`await request.text()` — must NOT be parsed as JSON first), then
 * reconciles our `subscriptions` table and the `profiles.is_pro` / `pro_tier`
 * mirror via the service-role admin client.
 *
 * Handled events:
 *   - checkout.session.completed       → record customer/subscription, mark Pro
 *   - customer.subscription.updated    → sync status/tier/period, set Pro flag
 *   - customer.subscription.deleted    → clear Pro flag, mark canceled
 *
 * Contract: returns 200 fast on success or ignored event types; 400 on bad
 * signature; 503 when unconfigured (no secret key / webhook secret) so retries
 * are sane. We always return 200 for handler-internal DB hiccups we can't fix
 * by retrying differently — but here we surface a 500 only on truly unexpected
 * cases so Stripe will retry.
 */
import { NextResponse, type NextRequest } from "next/server";
import type Stripe from "stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  getStripe,
  isStripeConfigured,
  isStripeWebhookConfigured,
  tierForPriceId,
} from "@/lib/stripe";
import type { ProfileUpdate } from "@/types/database";

export const runtime = "nodejs";

/** Statuses Stripe sends; we mark Pro for these. */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

export async function POST(request: NextRequest) {
  // Unconfigured (dev default) → 503, don't pretend to process.
  if (!isStripeConfigured() || !isStripeWebhookConfigured()) {
    return NextResponse.json(
      { error: "Stripe webhook not configured" },
      { status: 503 },
    );
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // RAW body for signature verification — never JSON.parse before this.
  const rawBody = await request.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET as string;

  let event: Stripe.Event;
  try {
    const stripe = getStripe();
    event = await stripe.webhooks.constructEventAsync(rawBody, signature, secret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid signature";
    return NextResponse.json(
      { error: `Webhook signature verification failed: ${message}` },
      { status: 400 },
    );
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object);
        break;
      case "customer.subscription.updated":
        await handleSubscriptionChange(event.data.object, false);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionChange(event.data.object, true);
        break;
      default:
        // Acknowledge unhandled events so Stripe stops retrying.
        break;
    }
  } catch (err) {
    // Unexpected processing failure — 500 lets Stripe retry the event.
    const message = err instanceof Error ? err.message : "Handler error";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true }, { status: 200 });
}

// ── Handlers ───────────────────────────────────────────────────────────

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
): Promise<void> {
  // Only subscription checkouts grant entitlements here.
  if (session.mode !== "subscription") return;

  const userId =
    session.client_reference_id ??
    (typeof session.metadata?.user_id === "string"
      ? session.metadata.user_id
      : null);
  if (!userId) return;

  const customerId = idFrom(session.customer);
  const subscriptionId = idFrom(session.subscription);

  // Fetch the subscription to learn the price/tier, status, and period end.
  let tier: "pro" | "team" | null = null;
  let status: string | null = null;
  let periodEnd: string | null = null;

  if (subscriptionId) {
    try {
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(subscriptionId);
      tier = tierForSubscription(sub);
      status = sub.status;
      periodEnd = periodEndFrom(sub);
    } catch {
      // If we can't expand, fall back to "pro" from metadata price_key.
    }
  }

  if (!tier) {
    const priceKey = session.metadata?.price_key;
    tier = priceKey === "team_monthly" ? "team" : "pro";
  }

  await persist({
    userId,
    customerId,
    subscriptionId,
    tier,
    status: status ?? "active",
    periodEnd,
    isActive: true,
  });
}

async function handleSubscriptionChange(
  sub: Stripe.Subscription,
  deleted: boolean,
): Promise<void> {
  const customerId = idFrom(sub.customer);

  // Resolve the user: prefer subscription metadata, else look up by customer.
  let userId =
    typeof sub.metadata?.user_id === "string" ? sub.metadata.user_id : null;
  if (!userId && customerId) {
    userId = await userIdByCustomer(customerId);
  }
  if (!userId) return;

  const tier = tierForSubscription(sub) ?? "pro";
  const status = deleted ? "canceled" : sub.status;
  const isActive = !deleted && ACTIVE_STATUSES.has(sub.status);

  await persist({
    userId,
    customerId,
    subscriptionId: sub.id,
    tier,
    status,
    periodEnd: periodEndFrom(sub),
    isActive,
  });
}

// ── Persistence ─────────────────────────────────────────────────────────

interface PersistArgs {
  userId: string;
  customerId: string | null;
  subscriptionId: string | null;
  tier: "pro" | "team";
  status: string;
  periodEnd: string | null;
  isActive: boolean;
}

async function persist(args: PersistArgs): Promise<void> {
  const admin = createAdminClient();

  // Upsert the authoritative subscriptions row (keyed by user_id).
  const { error: subErr } = await admin.from("subscriptions").upsert(
    {
      user_id: args.userId,
      stripe_customer_id: args.customerId,
      stripe_subscription_id: args.subscriptionId,
      status: args.status,
      tier: args.tier,
      current_period_end: args.periodEnd,
    },
    { onConflict: "user_id" },
  );
  if (subErr) throw new Error(`subscriptions upsert failed: ${subErr.message}`);

  // Mirror onto the profile for cheap reads / fallback.
  const profilePatch: ProfileUpdate = {
    is_pro: args.isActive,
    pro_tier: args.isActive ? args.tier : null,
  };
  const { error: profErr } = await admin
    .from("profiles")
    .update(profilePatch)
    .eq("id", args.userId);
  if (profErr) throw new Error(`profiles update failed: ${profErr.message}`);
}

async function userIdByCustomer(customerId: string): Promise<string | null> {
  try {
    const admin = createAdminClient();
    const { data } = await admin
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    return data?.user_id ?? null;
  } catch {
    return null;
  }
}

// ── Small Stripe-shape helpers ───────────────────────────────────────────

/** Stripe fields are `string | Expandable<T> | null`; pull the id out. */
function idFrom(
  value: string | { id: string } | null | undefined,
): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Derive our tier from the subscription's first item price id. */
function tierForSubscription(sub: Stripe.Subscription): "pro" | "team" | null {
  const priceId = sub.items?.data?.[0]?.price?.id ?? null;
  return tierForPriceId(priceId);
}

/**
 * Current period end → ISO string. Across Stripe API versions this lives either
 * on the subscription or on the line item; read defensively without `any`.
 */
function periodEndFrom(sub: Stripe.Subscription): string | null {
  const record = sub as unknown as Record<string, unknown>;
  let unix: number | null =
    typeof record.current_period_end === "number"
      ? record.current_period_end
      : null;

  if (unix === null) {
    const item = sub.items?.data?.[0] as unknown as
      | Record<string, unknown>
      | undefined;
    if (item && typeof item.current_period_end === "number") {
      unix = item.current_period_end;
    }
  }

  return unix === null ? null : new Date(unix * 1000).toISOString();
}
