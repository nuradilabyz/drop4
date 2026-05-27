"use client";

/**
 * Vertical per-move advantage chart (ported from coach.jsx EvalBar).
 *
 * Each bar = the eval AFTER that ply, from the coached player's POV. Positive
 * (you ahead) grows up in coral; negative (opponent ahead) grows down in aqua.
 * The bar for the currently-scrubbed ply is highlighted and marked with a
 * caret. Clicking a bar scrubs to that ply.
 *
 * `evals` are centipawns from PLAYER-1 ('c') POV (the `CoachAnalysis.evalBar`).
 * If the coached `you` side is 'a', pass `flip` so the chart is from your POV.
 */

import { useMemo, type CSSProperties } from "react";
import styles from "./EvalBar.module.css";

export interface EvalBarProps {
  /** Per-ply eval (cp) from player-1 ('c') POV. */
  evals: number[];
  /** 0-indexed ply currently displayed. */
  current: number;
  /** Flip POV (when the coached side is 'a'). */
  flip?: boolean;
  /** Click a bar → scrub to that ply (0-indexed). */
  onScrub?: (ply: number) => void;
  /** Name shown on the "ahead" (you +) side. */
  youLabel?: string;
  /** Name shown on the "behind" (opponent −) side. */
  oppLabel?: string;
}

/** Cap (cp) at which a bar reaches full height. ~3 pawns of advantage. */
const BAR_MAX_CP = 350;
const BAR_HALF_PX = 28;

export function EvalBar({
  evals,
  current,
  flip = false,
  onScrub,
  youLabel = "You",
  oppLabel = "Opp",
}: EvalBarProps) {
  const series = useMemo(
    () => (flip ? evals.map((e) => -e) : evals),
    [evals, flip],
  );

  return (
    <div className={styles.wrap}>
      <div className={styles.legend}>
        <span className={styles.mono}>− {oppLabel}</span>
        <span>Eval</span>
        <span className={styles.mono}>{youLabel} +</span>
      </div>
      <div className={styles.bars} role="img" aria-label="Per-move evaluation chart">
        {series.map((cp, i) => {
          const mag = Math.min(Math.abs(cp), BAR_MAX_CP);
          const h = (mag / BAR_MAX_CP) * BAR_HALF_PX;
          const positive = cp >= 0;
          const isCurrent = i === current;
          const cls = [
            styles.fill,
            positive ? styles.up : styles.down,
            isCurrent && styles.current,
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <button
              key={i}
              type="button"
              className={styles.col}
              onClick={() => onScrub?.(i)}
              aria-label={`Move ${i + 1}, eval ${(cp / 100).toFixed(1)}`}
              aria-current={isCurrent ? "true" : undefined}
            >
              {positive ? (
                <>
                  <span className={cls} style={{ "--h": `${h}px` } as CSSProperties} />
                  <span className={styles.mid} />
                  <span className={styles.spacer} />
                </>
              ) : (
                <>
                  <span className={styles.spacer} />
                  <span className={styles.mid} />
                  <span className={cls} style={{ "--h": `${h}px` } as CSSProperties} />
                </>
              )}
              {isCurrent && <span className={styles.caret} aria-hidden="true">↓</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
