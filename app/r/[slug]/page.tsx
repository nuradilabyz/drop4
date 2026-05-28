import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { DuelRoom } from "./DuelRoom";

export const metadata: Metadata = {
  title: "Duel room",
  description: "Drop4 — a turn-based 1v1 Connect Four duel, shared by link.",
};

// Next.js 16: route `params`/`searchParams` are Promises (see AGENTS.md). Typed
// inline so the file stays valid even with stale typegen; the generated
// `PageProps<'/r/[slug]'>` resolves to the same shape.
interface RoomRouteProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/**
 * Resolve the viewer's display name from the auth cookie + profiles row.
 * Anonymous-auth and unsigned visitors return null so the client can show
 * the guest "what's your name?" prompt before they join the duel — that's
 * what the host sees in the header, so empty names aren't acceptable.
 */
async function loadViewerName(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user || user.is_anonymous) return null;
    const { data } = await supabase
      .from("profiles")
      .select("display_name, username")
      .eq("id", user.id)
      .maybeSingle<{ display_name: string | null; username: string | null }>();
    return data?.display_name?.trim() || data?.username || null;
  } catch {
    return null;
  }
}

/**
 * Duel room shell. Awaits the slug + the `?spectate` flag, then hands them to
 * the client controller, which owns realtime, the room claim, and gameplay.
 * The origin is resolved client-side (from `window.location.origin`) for the
 * shareable link, so this server component stays dependency-light.
 */
export default async function RoomPage(props: RoomRouteProps) {
  const { slug } = await props.params;
  const sp = await props.searchParams;
  const spectateRaw = Array.isArray(sp.spectate) ? sp.spectate[0] : sp.spectate;
  const spectate = spectateRaw === "1" || spectateRaw === "true";
  const viewerName = await loadViewerName();

  return (
    <main>
      <DuelRoom slug={slug} spectate={spectate} initialViewerName={viewerName} />
    </main>
  );
}
