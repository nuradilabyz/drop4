"use client";

/**
 * Client controller for a duel room. Binds `useDuelGame` → `GameView`, and
 * renders the waiting-room / closed / error surfaces around it.
 *
 * Convention (from GameView): the LOCAL player is the `left` pane, the opponent
 * is `right`. For spectators (read-only), `left` = host, `right` = guest and the
 * board's `onDrop` is undefined. The shareable link, presence and idle countdown
 * all come from the hook.
 */

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { GameView, type GameViewProps } from "@/components/game/GameView";
import type { MoveRailItem, PlayerPaneProps } from "@/components/game/PlayerPane";
import type { WinBannerProps } from "@/components/game/WinBanner";
import { Chip, Icon, Toast, useToast } from "@/components/ui";
import { RoomStatus, SpectatorBadge, WaitingRoom } from "@/components/duel";
import { useDuelGame } from "@/lib/game/useDuelGame";
import { getMatch } from "@/lib/game/matchStore";
import { copyShareLink, copyText } from "@/lib/share";
import type { Coord, Movelist, Player } from "@/engine/types";
import styles from "@/components/duel/duel.module.css";

export interface DuelRoomProps {
  slug: string;
  spectate: boolean;
}

/** Last N moves for one chip colour, newest first → rail items. */
function railFor(movelist: Movelist, starter: Player, who: Player, limit = 4): MoveRailItem[] {
  const items: MoveRailItem[] = [];
  for (let i = 0; i < movelist.length; i++) {
    const mover: Player = i % 2 === 0 ? starter : starter === "c" ? "a" : "c";
    if (mover !== who) continue;
    items.push({ n: i + 1, player: mover, label: `col ${movelist[i] + 1}` });
  }
  return items.reverse().slice(0, limit);
}

function lineLabel(coords: Coord[] | null): string {
  if (!coords || coords.length < 2) return "the board";
  const [c0, r0] = coords[0];
  const [c1, r1] = coords[1];
  if (r1 - r0 === 0) return "the row";
  if (c1 - c0 === 0) return "the column";
  return "the diagonal";
}

function fmtIdle(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function DuelRoom({ slug, spectate }: DuelRoomProps) {
  const router = useRouter();
  const game = useDuelGame({ slug, spectate, name: spectate ? "Watcher" : "You" });

  const { message: toast, show: showToast } = useToast();

  const onShare = useCallback(async () => {
    // Finished duel → share the OG result card. Live / waiting → share the room
    // invite link so a friend can join (or spectate).
    if (game.phase === "finished") {
      const id = game.saveForCoach();
      const match = id ? getMatch(id) : null;
      if (match) {
        const ok = await copyShareLink(match);
        showToast(ok ? "Result link copied ✦" : "Couldn’t copy link");
        return;
      }
    }
    const ok = game.shareUrl ? await copyText(game.shareUrl) : false;
    showToast(
      ok ? "Invite link copied ✦ send it to a friend" : "Couldn’t copy link",
    );
  }, [game, showToast]);

  const onOpenCoach = useCallback(() => {
    const id = game.saveForCoach();
    if (id) router.push(`/coach/${id}`);
  }, [game, router]);

  // ── Terminal / pre-game surfaces ──
  if (game.phase === "connecting") {
    return <RoomStatus kind="connecting" message={game.message} />;
  }
  if (game.phase === "error") {
    return <RoomStatus kind="error" message={game.message} />;
  }
  if (game.phase === "closed") {
    return <RoomStatus kind="closed" message={game.message} />;
  }
  if (game.phase === "waiting") {
    return (
      <WaitingRoom
        slug={slug}
        shareUrl={game.shareUrl}
        idleMsLeft={game.idleMsLeft}
        opponentJoining={game.spectatorCount === 0 && game.opponentOnline}
      />
    );
  }

  // ── Live game (playing / finished) ──
  const finished = game.phase === "finished";

  // Determine display chips. host = coral, guest = aqua; spectators view host on
  // the left. For a player, the local player is always `left`.
  const isSpectator = game.seat === "spectator";

  // Resolve each pane's chip + identity.
  const leftChip: Player = isSpectator ? "c" : (game.myChip ?? "c");
  const rightChip: Player = leftChip === "c" ? "a" : "c";

  const leftName = isSpectator ? "Host" : "You";
  const rightName = isSpectator ? "Guest" : game.opponentName;

  // Whose turn highlights which pane.
  const leftActive = !finished && game.current === leftChip;
  const rightActive = !finished && game.current === rightChip;
  // Opponent "thinking" indicator (their turn + online).
  const oppThinking = !isSpectator && rightActive && game.opponentOnline;

  const left: PlayerPaneProps = {
    name: leftName,
    chip: leftChip,
    active: leftActive,
    timer: "0:00",
    series: `${game.series[leftChip]}W`,
    moves: railFor(game.movelist, game.starter, leftChip),
    totalMoves: game.movelist.length,
  };

  const right: PlayerPaneProps = {
    name: rightName,
    chip: rightChip,
    active: rightActive,
    timer: oppThinking ? "thinking…" : "0:00",
    series: `${game.series[rightChip]}W`,
    moves: railFor(game.movelist, game.starter, rightChip),
    totalMoves: game.movelist.length,
  };

  const youWon = !isSpectator && game.winner === game.myChip;

  const score: GameViewProps["score"] = {
    leftLabel: leftName,
    leftScore: game.series[leftChip],
    rightLabel: rightName,
    rightScore: game.series[rightChip],
    series: undefined,
  };

  const statusLabel = finished
    ? game.result === "draw"
      ? "Draw"
      : youWon
        ? "You won"
        : isSpectator
          ? "Game over"
          : "You lost"
    : `Move ${game.movelist.length + 1} · ${
        game.myTurn
          ? "your turn"
          : isSpectator
            ? `${game.current === leftChip ? leftName : rightName} to move`
            : oppThinking
              ? "opponent thinking…"
              : "opponent's turn"
      }`;

  const banner: WinBannerProps | null = finished
    ? {
        winner: game.winner,
        youWon,
        winnerName:
          game.winner === null
            ? undefined
            : game.winner === leftChip
              ? leftName
              : rightName,
        lineLabel: lineLabel(game.winLine),
      }
    : null;

  const modeLabel = isSpectator
    ? "Duel · Spectating"
    : `Duel · Casual${game.opponentOnline ? "" : " · opponent offline"}`;

  // Footer: presence + idle countdown + spectator badge.
  const footerSlot = (
    <div className={styles.footer}>
      {isSpectator ? (
        <SpectatorBadge count={game.spectatorCount} />
      ) : (
        <span className={styles.presence}>
          <span
            className={styles.presenceDot}
            data-online={game.opponentOnline}
          />
          {game.opponentOnline ? "Opponent online" : "Opponent left"}
        </span>
      )}
      {game.spectatorCount > 0 && !isSpectator && (
        <Chip tone="neutral" size="sm" icon={<Icon name="eye" size={11} />}>
          <span className="mono">{game.spectatorCount}</span> watching
        </Chip>
      )}
      {!finished && (
        <span className="mono" title="Room closes after 10 min idle">
          idle {fmtIdle(game.idleMsLeft)}
        </span>
      )}
      {finished && game.rematchPending && (
        <span className={styles.rematchHint}>
          <Icon name="refresh" size={12} /> Waiting for opponent to accept…
        </span>
      )}
      {finished && game.rematchOffered && (
        <span className={styles.rematchHint}>
          <Icon name="refresh" size={12} /> Opponent wants a rematch
        </span>
      )}
    </div>
  );

  // Board input only for the local player on their turn.
  const canPlay = !isSpectator && game.myTurn && !finished;

  return (
    <>
    <GameView
      modeLabel={modeLabel}
      left={left}
      right={right}
      score={score}
      finished={finished}
      banner={banner}
      onResign={isSpectator ? undefined : game.resign}
      onShare={onShare}
      footerSlot={footerSlot}
      board={{
        cells: game.cells,
        nextPlayer: game.current,
        winLine: game.winLine,
        disabled: !canPlay,
        onDrop: isSpectator ? undefined : game.play,
        showColLabels: true,
      }}
      controls={{
        finished,
        // No engine in duels → hints / threats are unavailable (locked at 0).
        isPro: false,
        hintsLeft: 0,
        threatsLeft: 0,
        threatsBudget: 0,
        threatsOn: false,
        statusLabel,
        busy: !canPlay,
        onHint: undefined,
        onToggleThreats: undefined,
        onRematch: isSpectator ? undefined : game.rematch,
        onOpenCoach,
        onShare,
        rematchLabel: game.rematchOffered ? "Accept rematch" : "Rematch",
      }}
    />
    <Toast message={toast} />
    </>
  );
}
