/**
 * Lazy Stripe client + price-id map. SERVER-ONLY.
 *
 * The Stripe SDK must never be constructed at module import: in dev the
 * `STRIPE_SECRET_KEY` is empty, and constructing without a key throws. Instead
 * we expose `getStripe()` which lazily builds (and memoizes) the client and
 * throws a clear error only when CALLED without a key. `isStripeConfigured()`
 * lets callers degrade gracefully (redirect with a flag) instead of 500-ing.
 *
 * Do NOT import this file from a Client Component — it reads STRIPE_SECRET_KEY.
 */
import "server-only";
import Stripe from "stripe";

let cached: Stripe | null = null;

/**
 * Returns a memoized Stripe client. Throws a clear, actionable error if the
 * secret key is missing — only ever at call time, never at import.
 */
export function getStripe(): Stripe {
  if (cached) return cached;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "Stripe is not configured: STRIPE_SECRET_KEY is missing. " +
        "Set it in .env.local (test mode) to enable billing.",
    );
  }

  // No explicit `apiVersion`: the installed SDK (stripe@22) pins its own
  // bundled version ("2026-04-22.dahlia"), which is what we want for stable,
  // deterministic event shapes. Pinning a string literal here fights the SDK's
  // generated `LatestApiVersion` type, so we defer to the default.
  cached = new Stripe(key, {
    typescript: true,
    appInfo: { name: "Drop4", url: "https://drop4.app" },
  });
  return cached;
}

/** True when the server has a Stripe secret key available. */
export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** True when the webhook signing secret is available. */
export function isStripeWebhookConfigured(): boolean {
  return Boolean(process.env.STRIPE_WEBHOOK_SECRET);
}

/**
 * The price slugs the app advertises (must match `app/pricing` /
 * `lib/mockData` checkout hrefs).
 */
export type PriceKey = "pro_monthly" | "pro_yearly" | "team_monthly";

export const PRICE_KEYS: readonly PriceKey[] = [
  "pro_monthly",
  "pro_yearly",
  "team_monthly",
] as const;

export function isPriceKey(value: unknown): value is PriceKey {
  return (
    typeof value === "string" && (PRICE_KEYS as readonly string[]).includes(value)
  );
}

/** Which entitlement tier a given price grants. */
export const PRICE_TIER: Record<PriceKey, "pro" | "team"> = {
  pro_monthly: "pro",
  pro_yearly: "pro",
  team_monthly: "team",
};

/**
 * Maps a price slug → the Stripe Price ID from env. These NEXT_PUBLIC_* vars
 * are empty in dev; callers must handle a missing id (treat as unconfigured).
 */
export function priceIdFor(key: PriceKey): string | undefined {
  switch (key) {
    case "pro_monthly":
      return process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_MONTHLY || undefined;
    case "pro_yearly":
      return process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_YEARLY || undefined;
    case "team_monthly":
      return process.env.NEXT_PUBLIC_STRIPE_PRICE_TEAM_MONTHLY || undefined;
    default:
      return undefined;
  }
}

/** Resolve the tier ("pro" | "team") that a Stripe Price ID corresponds to. */
export function tierForPriceId(priceId: string | null | undefined): "pro" | "team" | null {
  if (!priceId) return null;
  for (const key of PRICE_KEYS) {
    if (priceIdFor(key) === priceId) return PRICE_TIER[key];
  }
  return null;
}
