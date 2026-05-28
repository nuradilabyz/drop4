import { createClient } from "@/lib/supabase/server";
import { MobileTabBarClient } from "./MobileTabBar.client";

/**
 * Server-side shell that resolves the "Me" tab from the real Supabase session
 * and hands it to the client tab bar. The signed-in-user lookup is identical
 * in spirit to the one in Nav.tsx — anonymous-auth (duel guests) is treated
 * as not-signed-in here so the tab bar never points strangers at a profile.
 */
async function resolveMeTab(): Promise<{ href: string; label: string }> {
  try {
    const supabase = await createClient();
    const { data: userResp } = await supabase.auth.getUser();
    const user = userResp.user;
    if (!user || user.is_anonymous) return { href: "/login", label: "Sign in" };

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.username) return { href: "/login", label: "Sign in" };
    return { href: `/profile/${profile.username}`, label: "Me" };
  } catch {
    return { href: "/login", label: "Sign in" };
  }
}

export async function MobileTabBar() {
  const me = await resolveMeTab();
  return <MobileTabBarClient meHref={me.href} meLabel={me.label} />;
}
