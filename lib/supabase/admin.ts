/**
 * Service-role Supabase client. SERVER-ONLY.
 *
 * !!! NEVER import this in a Client Component or anything bundled for the
 * browser. It uses SUPABASE_SERVICE_ROLE_KEY, which bypasses Row Level Security
 * entirely. Use it only in Route Handlers / Server Actions / webhooks for
 * trusted, server-authoritative writes (ranked Elo finalize, Stripe webhook,
 * daily-puzzle rotation, period rollover).
 */
import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      "Missing Supabase admin env vars (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
    );
  }

  return createSupabaseClient<Database>(url, serviceKey, {
    auth: {
      // No session persistence for a server-only privileged client.
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
