"use client";

/**
 * Client controller that binds useSoloGame → GameView for the solo (vs-AI) mode.
 * The server shell (page.tsx) awaits route params and passes the resolved id,
 * difficulty and mode here. Billing is wired separately, so `isPro` defaults to
 * false (the page passes it explicitly).
 */

import { useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useSoloGame, formatClock, formatThink } from "@/lib/game/useSoloGame";
import { getMatch } from "@/lib/game/matchStore";
import { copyShareLink } from "@/lib/share";
import { Toast, useToast } from "@/components/ui";
import type { MoveRailItem, PlayerPaneProps } from "@/components/game/PlayerPane";
import { GameView, type GameViewProps } from "@/components/game/GameView";
import type { Coord, Difficulty, Movelist, Player } from "@/engine/types";
import type { WinBannerProps } from "@/components/game/WinBanner";

export interface SoloGameProps {
  id: string;
  difficulty: Difficulty;
  /** Best-of-N (1 = single game). */
  bestOf?: number;
  /** Whether this solo game is the ranked "calibrated bot" fallback. */
  ranked?: boolean;
  isPro?: boolean;
}

/** Last N moves for a given player, newest first, mapped to rail items. */
function railFor(
  movelist: Movelist,
  thinkMs: number[],
  starter: Player,
  who: Player,
  limit = 4,
): MoveRailItem[] {
  const items: MoveRailItem[] = [];
  for (let i = 0; i < movelist.length; i++) {
    const mover: Player = i % 2 === 0 ? starter : starter === "c" ? "a" : "c";
    if (mover !== who) continue;
    items.push({
      n: i + 1,
      player: mover,
      label: `col ${movelist[i] + 1}`,
      dur: formatThink(thinkMs[i]),
    });
  }
  return items.reverse().slice(0, limit);
}

/** Describe the winning line direction for the banner copy. */
function lineLabel(coords: Coord[] | null): string {
  if (!coords || coords.length < 2) return "the board";
  const [c0, r0] = coords[0];
  const [c1, r1] = coords[1];
  const dc = c1 - c0;
  const dr = r1 - r0;
  if (dr === 0) return "the row";
  if (dc === 0) return "the column";
  return "the diagonal";
}

export function SoloGame({
  id,
  difficulty,
  bestOf = 1,
  ranked = false,
  isPro = false,
}: SoloGameProps) {
  const router = useRouter();
  const game = useSoloGame({
    id,
    difficulty,
    bestOf,
    isPro,
    humanName: "You",
    aiName: ranked ? "Calibrated bot" : undefined,
  });

  const finished = game.status === "won" || game.status === "draw";
  const humanTurn = game.status === "playing" && game.current === "c";

  const onHint = useCallback(() => {
    void game.requestHint();
  }, [game]);

  const onToggleThreats = useCallback(() => {
    void game.toggleThreats();
  }, [game]);

  const onOpenCoach = useCallback(() => {
    const savedId = game.saveForCoach();
    router.push(`/coach/${savedId}`);
  }, [game, router]);

  const { message: toast, show: showToast } = useToast();

  const onShare = useCallback(async () => {
    // Persist the canonical finished record (reuses the coach snapshot path),
    // then copy its public /m/<token> link — it unfurls as the OG match card.
    const savedId = game.saveForCoach();
    const match = getMatch(savedId);
    const ok = match ? await copyShareLink(match) : false;
    showToast(ok ? "Share link copied ✦ paste it anywhere" : "Couldn’t copy link");
  }, [game, showToast]);

  // ── PlayerPanes ──
  const left: PlayerPaneProps = useMemo(
    () => ({
      name: game.players.human.name,
      chip: "c",
      city: "Almaty",
      active: humanTurn,
      timer: formatClock(game.current === "c" ? game.turnMs : 0),
      series: bestOf > 1 ? `${game.series.c}W` : undefined,
      moves: railFor(game.movelist, game.thinkMs, game.starter, "c"),
      totalMoves: game.movelist.length,
    }),
    [game, humanTurn, bestOf],
  );

  const right: PlayerPaneProps = useMemo(
    () => ({
      name: game.players.ai.name,
      chip: "a",
      city: "The cloud",
      active: game.status === "thinking",
      timer: formatClock(game.current === "a" ? game.turnMs : 0),
      series: bestOf > 1 ? `${game.series.a}W` : undefined,
      moves: railFor(game.movelist, game.thinkMs, game.starter, "a"),
      totalMoves: game.movelist.length,
    }),
    [game, bestOf],
  );

  // ── Score header ──
  // Use the persistent `series` tally regardless of `bestOf` — the previous
  // single-game shortcut read `game.winner` for the score, which is nulled
  // out by `resetBoard()` on rematch, so winning game 1 → clicking Rematch
  // erased the "1" the user had just earned. The hook's series counter
  // already increments at game-end and stays put across rematches.
  const score: GameViewProps["score"] = {
    leftLabel: "You",
    leftScore: game.series.c,
    rightLabel: ranked ? "Bot" : "AI",
    rightScore: game.series.a,
    series:
      bestOf > 1
        ? `Game ${Math.min(game.series.c + game.series.a + 1, bestOf)} of ${bestOf}`
        : undefined,
  };

  // ── Bottom-rail status: "Move N · M:SS elapsed" ──
  const statusLabel = `Move ${game.movelist.length + (finished ? 0 : 1)} · ${formatClock(
    game.elapsedMs + (finished ? 0 : game.turnMs),
  )} elapsed`;

  const rematchLabel = game.seriesOver
    ? "New series"
    : bestOf > 1
      ? "Next game"
      : "Rematch";

  // ── Banner ──
  const banner: WinBannerProps | null = finished
    ? {
        winner: game.winner,
        youWon: game.winner === "c",
        winnerName: game.players.ai.name,
        lineLabel: lineLabel(game.winLine),
      }
    : null;

  const modeLabel = ranked
    ? `Ranked · vs ${difficulty} bot`
    : bestOf > 1
      ? `Solo · ${game.players.ai.name} · Best of ${bestOf}`
      : `Solo · ${game.players.ai.name}`;

  return (
    <>
    <GameView
      modeLabel={modeLabel}
      left={left}
      right={right}
      score={score}
      finished={finished}
      banner={banner}
      onResign={game.resign}
      onShare={onShare}
      board={{
        cells: game.cells,
        nextPlayer: game.current,
        winLine: game.winLine,
        threats: game.threats,
        hintCol: game.hintCol,
        disabled: !humanTurn,
        onDrop: game.play,
        showColLabels: true,
      }}
      controls={{
        finished,
        isPro,
        hintsLeft: game.hintsLeft,
        threatsLeft: game.threatsLeft,
        threatsBudget: 3,
        threatsOn: game.threatsOn,
        statusLabel,
        busy: !humanTurn,
        onHint,
        onToggleThreats,
        onRematch: game.rematch,
        onOpenCoach,
        onShare,
        rematchLabel,
      }}
    />
    <Toast message={toast} />
    </>
  );
}
