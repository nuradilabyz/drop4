"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  COLS,
  ROWS,
  columnHeight,
  type Cells,
  type Coord,
  type Player,
} from "@/engine/types";
import { playDrop, playWin } from "@/lib/sound";
import styles from "./Board.module.css";

export type BoardSize = "sm" | "md" | "lg";

const SIZE_VARS: Record<BoardSize, CSSProperties> = {
  sm: { "--board-max": "330px", "--cell-gap": "6px", "--board-pad": "10px" } as CSSProperties,
  md: { "--board-max": "510px", "--cell-gap": "8px", "--board-pad": "14px" } as CSSProperties,
  lg: { "--board-max": "690px", "--cell-gap": "10px", "--board-pad": "18px" } as CSSProperties,
};

export interface BoardProps {
  cells: Cells;
  size?: BoardSize;
  /** Color of the hover ghost / whose turn it is. */
  nextPlayer?: Player;
  /** Winning four to glow. */
  winLine?: Coord[] | null;
  /** Cells to mark with a dashed threat ring. */
  threats?: Coord[];
  /** Dim non-winning discs (analysis mode). */
  ghosting?: boolean;
  showColLabels?: boolean;
  /** When provided, the board is interactive and calls back with the column. */
  onDrop?: (col: number) => void;
  /** Block input (e.g. opponent's turn or engine thinking). */
  disabled?: boolean;
  /** Animate the most recently added disc falling into place. */
  animateDrops?: boolean;
  /** Play drop/win sounds when discs land (opt-in; live games only). */
  sound?: boolean;
  className?: string;
  "aria-label"?: string;
}

const key = (c: number, r: number) => `${c}.${r}`;

/** Find the single disc that was just added (top of a column), if exactly one. */
function findNewDisc(prev: Cells, curr: Cells): Coord | null {
  let found: Coord | null = null;
  for (let c = 0; c < COLS; c++) {
    const ph = prev[c]?.length ?? 0;
    const ch = curr[c]?.length ?? 0;
    if (ch === ph + 1) {
      if (found) return null; // more than one change → don't single out
      found = [c, ch - 1];
    } else if (ch !== ph) {
      return null; // a column shrank or jumped → a reset/load, not a drop
    }
  }
  return found;
}

const DISC_COLOR: Record<Player, string> = {
  c: "var(--coral)",
  a: "var(--aqua)",
};

export function Board({
  cells,
  size = "md",
  nextPlayer = "c",
  winLine = null,
  threats = [],
  ghosting = false,
  showColLabels = false,
  onDrop,
  disabled = false,
  animateDrops = true,
  sound = false,
  className,
  "aria-label": ariaLabel,
}: BoardProps) {
  const [hoverCol, setHoverCol] = useState<number | null>(null);
  const prevRef = useRef<Cells>(cells);
  const [newDisc, setNewDisc] = useState<Coord | null>(null);

  useEffect(() => {
    const added = findNewDisc(prevRef.current, cells);
    if (added) {
      if (sound) playDrop();
      if (animateDrops) {
        setNewDisc(added);
        const t = setTimeout(() => setNewDisc(null), 480);
        prevRef.current = cells;
        return () => clearTimeout(t);
      }
    }
    prevRef.current = cells;
  }, [cells, animateDrops, sound]);

  // Win chime when the winning line first appears.
  const hadWinRef = useRef(false);
  useEffect(() => {
    const hasWin = (winLine?.length ?? 0) > 0;
    if (hasWin && !hadWinRef.current && sound) playWin();
    hadWinRef.current = hasWin;
  }, [winLine, sound]);

  const interactive = Boolean(onDrop) && !disabled;
  const winSet = useMemo(
    () => new Set((winLine ?? []).map(([c, r]) => key(c, r))),
    [winLine],
  );
  const threatSet = useMemo(
    () => new Set(threats.map(([c, r]) => key(c, r))),
    [threats],
  );

  const handleEnter = (c: number) => interactive && setHoverCol(c);
  const handleLeave = () => setHoverCol(null);
  const handleClick = (c: number) => {
    if (interactive && columnHeight(cells, c) < ROWS) onDrop!(c);
  };

  return (
    <div
      className={[styles.board, className].filter(Boolean).join(" ")}
      style={SIZE_VARS[size]}
      role="grid"
      aria-label={ariaLabel ?? "Connect Four board"}
    >
      <div className={styles.grid} aria-hidden="true">
        {Array.from({ length: ROWS }, (_, displayRow) => {
          const r = ROWS - 1 - displayRow; // data is bottom-up
          return Array.from({ length: COLS }, (_, c) => {
            const v = cells[c]?.[r] ?? null;
            const filled = v !== null;
            const inWin = winSet.has(key(c, r));
            const isThreat = threatSet.has(key(c, r));
            const isHoverLanding =
              hoverCol === c && !filled && columnHeight(cells, c) === r;
            const isNew =
              newDisc !== null && newDisc[0] === c && newDisc[1] === r;

            return (
              <div key={key(c, r)} className={styles.cell}>
                {filled && (
                  <div
                    className={[
                      styles.disc,
                      inWin && styles.win,
                      ghosting && !inWin && styles.dim,
                      isNew && styles.dropping,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    style={
                      {
                        "--disc": DISC_COLOR[v],
                        "--drop-from": `${-(displayRow + 1) * 120}%`,
                      } as CSSProperties
                    }
                  />
                )}
                {isHoverLanding && (
                  <div
                    className={styles.ghost}
                    style={{ "--disc": DISC_COLOR[nextPlayer] } as CSSProperties}
                  />
                )}
                {isThreat && !filled && <div className={styles.threat} />}
              </div>
            );
          });
        })}
      </div>

      {interactive && (
        <div className={styles.cols}>
          {Array.from({ length: COLS }, (_, c) => (
            <button
              key={c}
              type="button"
              className={styles.colzone}
              disabled={columnHeight(cells, c) >= ROWS}
              aria-label={`Drop in column ${c + 1}`}
              onMouseEnter={() => handleEnter(c)}
              onMouseLeave={handleLeave}
              onFocus={() => handleEnter(c)}
              onBlur={handleLeave}
              onClick={() => handleClick(c)}
            />
          ))}
        </div>
      )}

      {showColLabels && (
        <div className={styles.labels} aria-hidden="true">
          {Array.from({ length: COLS }, (_, c) => (
            <span key={c}>{c + 1}</span>
          ))}
        </div>
      )}
    </div>
  );
}
