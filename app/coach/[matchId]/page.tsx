import type { Metadata } from "next";
import { CoachView } from "./CoachView";

// Next.js 16: route `params` is a Promise (see AGENTS.md). Typed inline so the
// file stays valid even with stale typegen; the generated
// `PageProps<'/coach/[matchId]'>` resolves to the same shape.
interface CoachRouteProps {
  params: Promise<{ matchId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export const metadata: Metadata = {
  title: "AI Coach",
  description: "Post-game analysis: engine evaluation, key moments, and what the coach saw.",
};

export default async function CoachPage(props: CoachRouteProps) {
  const { matchId } = await props.params;
  const sp = await props.searchParams;
  // `?pro=1` / `?pro=true` unlocks the full per-move narration for now. The
  // real billing gate is wired separately (do not import the billing module).
  const proParam = Array.isArray(sp.pro) ? sp.pro[0] : sp.pro;
  const isPro = proParam === "1" || proParam === "true";

  return <CoachView matchId={matchId} isPro={isPro} />;
}
