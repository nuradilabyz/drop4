/**
 * Browser-side Supabase client for use in Client Components.
 *
 * Uses only the public anon key + URL (both `NEXT_PUBLIC_*`). Safe to import
 * in client components. Never put service-role logic here.
 */
import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database";

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
