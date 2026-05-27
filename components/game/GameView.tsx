"use client";

/**
 * GameView — the reusable game surface (top bar + 3-column play area).
 *
 * Layout (desktop): [ left PlayerPane | center (ScoreHeader + Board + controls) |
 * right PlayerPane ]. Collapses to a single stacked column on mobile.
 *
 * This component is intentionally "dumb": it is driven entirely by props so that
 * BOTH the solo controller (useSoloGame) and a future realtime duel controller
 * can render it. It owns no game rules — only presentation and wiring board
 * clicks / control callbacks back up to whatever controller supplied the props.
 *
 * The duel agent can reuse this by mapping its own state to `GameViewProps`:
 *   - `left` / `right` describe the two PlayerPanes (the local player is `left`).
 *   - `board` carries everything <Board> needs plus the drop handler.
 *   - `controls` is forwarded to <GameControls> (the bottom rail).
 *   - `banner` / `finished` toggle the post-game presentation.
 */

import type { ReactNode } from "react";
import type { BoardSize } from "@/components/board/Board";
import { Board } from "@/components/board/Board";
import type { Cells, Coord, Player } from "@/engine/types";
import { GameTopBar } from "./GameTopBar";
import { ScoreHeader } from "./ScoreHeader";
import { PlayerPane, type PlayerPaneProps } from "./PlayerPane";
import { GameControls, type GameControlsProps } from "./GameControls";
import { WinBanner, type WinBannerProps } from "./WinBanner";
import styles from "./GameView.module.css";

export interface GameViewBoardProps {
  cells: Cells;
  /** Whose ghost/turn colour to show. */
  nextPlayer: Player;
  winLine?: Coord[] | null;
  threats?: Coord[];
  /** Transient engine-hint column to glow (rendered as a soft column tint). */
  hintCol?: number | null;
  size?: BoardSize;
  /** Block input (opponent's turn / engine thinking / game over). */
  disabled?: boolean;
  onDrop?: (col: number) => void;
  showColLabels?: boolean;
}

export interface GameViewProps {
  /** Top-bar mode label, e.g. "Solo · Hard AI" or "Duel · Casual". */
  modeLabel: string;
  /** Left pane = the local player by convention. */
  left: PlayerPaneProps;
  /** Right pane = the opponent. */
  right: PlayerPaneProps;
  /** Score header values. */
  score: {
    leftLabel: string;
    leftScore: number;
    rightLabel: string;
    rightScore: number;
    series?: string;
  };
  board: GameViewBoardProps;
  controls: GameControlsProps;
  /** Show the floating win/draw banner over the board. */
  banner?: WinBannerProps | null;
  /** Whether the game has ended (hides resign, dims interactions). */
  finished?: boolean;
  /** Top-bar actions. */
  onResign?: () => void;
  onShare?: () => void;
  onSettings?: () => void;
  /** Optional slot rendered under the controls (e.g. series-over CTA). */
  footerSlot?: ReactNode;
}

export function GameView({
  modeLabel,
  left,
  right,
  score,
  board,
  controls,
  banner = null,
  finished = false,
  onResign,
  onShare,
  onSettings,
  footerSlot,
}: GameViewProps) {
  return (
    <div className={styles.shell}>
      <GameTopBar
        modeLabel={modeLabel}
        canResign={!finished}
        onResign={onResign}
        onShare={onShare}
        onSettings={onSettings}
      />

      <div className={styles.area}>
        <div className={styles.sideLeft}>
          <PlayerPane {...left} />
        </div>

        <div className={styles.center}>
          <ScoreHeader {...score} />

          <div
            className={styles.boardWrap}
            data-hint={board.hintCol ?? undefined}
            style={
              board.hintCol != null
                ? ({ "--hint-col": board.hintCol } as React.CSSProperties)
                : undefined
            }
          >
            {banner && <WinBanner {...banner} />}
            <Board
              cells={board.cells}
              size={board.size ?? "lg"}
              nextPlayer={board.nextPlayer}
              winLine={board.winLine ?? null}
              threats={board.threats ?? []}
              showColLabels={board.showColLabels ?? true}
              disabled={board.disabled}
              onDrop={board.onDrop}
              ghosting={finished}
            />
            {board.hintCol != null && (
              <div className={styles.hintHint} aria-hidden="true">
                Engine: col {board.hintCol + 1}
              </div>
            )}
          </div>

          <GameControls {...controls} />
          {footerSlot}
        </div>

        <div className={styles.sideRight}>
          <PlayerPane {...right} />
        </div>
      </div>
    </div>
  );
}
