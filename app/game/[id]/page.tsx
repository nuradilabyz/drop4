import type { Metadata } from "next";
import type { Difficulty } from "@/engine/types";
import { SoloGame } from "./SoloGame";

export const metadata: Metadata = {
  title: "Game",
  description: "Drop4 — four in a row.",
};

const DIFFICULTIES: Difficulty[] = ["easy", "normal", "hard", "insane"];

function parseDifficulty(value: string | string[] | undefined): Difficulty {
  const v = Array.isArray(value) ? value[0] : value;
  return DIFFICULTIES.includes(v as Difficulty) ? (v as Difficulty) : "hard";
}

function parseBestOf(value: string | string[] | undefined): number {
  const v = Array.isArray(value) ? value[0] : value;
  const n = Number(v);
  return n === 3 || n === 5 || n === 7 ? n : 1;
}

// Next.js 16: route `params`/`searchParams` are Promises (see AGENTS.md). The
// generated `PageProps<'/game/[id]'>` global resolves to this same shape once
// typegen runs; typing it inline keeps the file valid even with stale typegen.
type SearchParams = Record<string, string | string[] | undefined>;
interface GameRouteProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}

/**
 * Game route shell. Next 16: `params` and `searchParams` are Promises — await
 * them, then hand the resolved values to the client controller. Solo is the only
 * mode wired here; duel (`mode=duel`) is handled by the realtime agent and falls
 * back to a solo board until that flow lands.
 */
export default async function GamePage(props: GameRouteProps) {
  const { id } = await props.params;
  const search = await props.searchParams;

  const mode = (Array.isArray(search.mode) ? search.mode[0] : search.mode) ?? "solo";
  const difficulty = parseDifficulty(search.difficulty);
  const bestOf = parseBestOf(search.bo);
  const ranked = mode === "ranked";

  // TODO: duel handled by realtime agent — `mode=duel` will mount a DuelGame
  // controller here. For now every mode renders the solo board (ranked uses the
  // calibrated-bot label).

  return (
    <main>
      <SoloGame
        id={id}
        difficulty={difficulty}
        bestOf={bestOf}
        ranked={ranked}
        isPro={false}
      />
    </main>
  );
}
