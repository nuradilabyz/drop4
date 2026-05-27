import type { Metadata } from "next";
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

  return (
    <main>
      <DuelRoom slug={slug} spectate={spectate} />
    </main>
  );
}
