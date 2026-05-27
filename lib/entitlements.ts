/**
 * Server entitlements. SERVER-ONLY.
 *
 * Single source of truth for "is this user Pro, and at what tier" on the
 * server. Reads the `subscriptions` table (authoritative, written by the
 * Stripe webhook) and falls back to `profiles.is_pro` / `profiles.pro_tier`
 * for resilience if a subscription row is missing.
 *
 * Client components must NOT import this module — it uses the service-role
 * admin client. Pass the resolved `Entitlements` down to the client via
 * `<ProProvider value={...}>` from `lib/entitlements-client.tsx`.
 */
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

export type ProTier = "free" | "pro" | "team";

export interface Entitlements {
  /** True for any paid tier (Pro or Team). */
  isPro: boolean;
  tier: ProTier;
}

/** What an unauthenticated / Stripe-less user gets. */
export const FREE_ENTITLEMENTS: Entitlements = { isPro: false, tier: "free" };

/** Subscription statuses we treat as currently granting access. */
const ACTIVE_STATUSES = new Set(["active", "trialing", "past_due"]);

function normalizeTier(raw: string | null | undefined): ProTier {
  if (raw === "team") return "team";
  if (raw === "pro") return "pro";
  return "free";
}

/**
 * Resolve a user's entitlements server-side.
 *
 * Order of truth:
 *   1. `subscriptions` row with an active-ish status → tier from that row.
 *   2. else `profiles.is_pro` / `profiles.pro_tier` (webhook also mirrors here).
 *   3. else free.
 *
 * Never throws for the caller's sake: any unexpected error (e.g. Supabase
 * unconfigured in dev) degrades to FREE rather than breaking the page.
 */
export async function getEntitlements(
  userId: string | null | undefined,
): Promise<Entitlements> {
  if (!userId) return FREE_ENTITLEMENTS;

  try {
    const admin = createAdminClient();

    const { data: sub } = await admin
      .from("subscriptions")
      .select("status, tier")
      .eq("user_id", userId)
      .maybeSingle();

    if (sub && sub.status && ACTIVE_STATUSES.has(sub.status)) {
      const tier = normalizeTier(sub.tier);
      if (tier !== "free") {
        return { isPro: true, tier };
      }
    }

    // Fallback: the profile mirror (kept in sync by the webhook).
    const { data: profile } = await admin
      .from("profiles")
      .select("is_pro, pro_tier")
      .eq("id", userId)
      .maybeSingle();

    if (profile?.is_pro) {
      const tier = normalizeTier(profile.pro_tier);
      return { isPro: true, tier: tier === "free" ? "pro" : tier };
    }

    return FREE_ENTITLEMENTS;
  } catch {
    // Supabase admin not configured (or transient failure): fail closed to free.
    return FREE_ENTITLEMENTS;
  }
}
