"use client";

/**
 * Client-side Pro entitlement context.
 *
 * Seeded from a value resolved on the server (via `getEntitlements()` in
 * `lib/entitlements.ts`) and passed into `<ProProvider value={...}>`. Client
 * components call `usePro()` to gate Pro features (unlimited hints, full AI
 * coach, skins, crown badge) without re-fetching.
 *
 * This file is intentionally separate from the server `lib/entitlements.ts` so
 * the service-role admin client never leaks into the client bundle.
 */
import { createContext, useContext, type ReactNode } from "react";

export type ProTier = "free" | "pro" | "team";

export interface Entitlements {
  isPro: boolean;
  tier: ProTier;
}

const DEFAULT_ENTITLEMENTS: Entitlements = { isPro: false, tier: "free" };

const ProContext = createContext<Entitlements>(DEFAULT_ENTITLEMENTS);

/**
 * Provide entitlements to the client tree. Pass the server-resolved value;
 * when omitted it defaults to free (so the app is safe without keys / auth).
 */
export function ProProvider({
  value,
  children,
}: {
  value?: Entitlements;
  children: ReactNode;
}) {
  return (
    <ProContext.Provider value={value ?? DEFAULT_ENTITLEMENTS}>
      {children}
    </ProContext.Provider>
  );
}

/**
 * Read the current user's entitlements on the client.
 * Defaults to `{ isPro: false, tier: "free" }` when no provider is mounted.
 */
export function usePro(): Entitlements {
  return useContext(ProContext);
}
