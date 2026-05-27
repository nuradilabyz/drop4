"use client";

/**
 * Vertical move timeline (ported from coach.jsx TimelineMove list).
 *
 * Each row: player dot + zero-padded move number + "col N · label" + a
 * colour-coded quality chip (good→Solid, miss→Missed, fork→Fork,
 * brilliant→Brilliant, blunder→Blunder, inaccuracy→Inaccuracy). An All/Key
 * filter toggles between every move and only the tagged ones. Clicking a row
 * scrubs the board to that ply.
 */

import { useMemo, useRef, useEffect } from "react";
import type { AnalyzedMove, MoveTag } from "@/lib/coach/analyze";
import styles from "./MoveTimeline.module.css";

export interface MoveTimelineProps {
  moves: AnalyzedMove[];
  /** 0-indexed ply currently displayed. */
  current: number;
  /** Annotation text keyed by 1-indexed move n (from the narration). */
  annotations?: Record<number, string>;
  filter: "all" | "key";
  onFilterChange: (f: "all" | "key") => void;
  /** Scrub to a ply (0-indexed). */
  onScrub: (ply: number) => void;
}

/** Tag → display chip metadata. `color` is a CSS var/expr. */
const TAG_META: Record<
  MoveTag,
  { label: string; color: string } | null
> = {
  good: { label: "Solid", color: "var(--success)" },
  inaccuracy: { label: "Inaccuracy", color: "var(--gold)" },
  miss: { label: "Missed", color: "var(--danger)" },
  blunder: { label: "Blunder", color: "var(--danger)" },
  fork: { label: "Fork", color: "var(--gold)" },
  brilliant: { label: "Brilliant", color: "var(--coral)" },
  normal: null,
};

/** A move is "key" if it carries a meaningful (non-good, non-normal) tag, or is
 * a fork/brilliant. Good moves are common, so they're hidden in the Key view. */
function isKey(m: AnalyzedMove): boolean {
  return (
    m.tag === "fork" ||
    m.tag === "brilliant" ||
    m.tag === "miss" ||
    m.tag === "blunder" ||
    m.tag === "inaccuracy"
  );
}

export function MoveTimeline({
  moves,
  current,
  annotations,
  filter,
  onFilterChange,
  onScrub,
}: MoveTimelineProps) {
  const shown = useMemo(
    () => (filter === "key" ? moves.filter(isKey) : moves),
    [moves, filter],
  );

  const listRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  // Keep the active row in view as the user scrubs / auto-plays.
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [current]);

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <h3 className={styles.title}>Move timeline</h3>
        <div className={styles.filters}>
          <button
            type="button"
            className={[styles.filter, filter === "all" && styles.filterOn]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onFilterChange("all")}
          >
            All
          </button>
          <button
            type="button"
            className={[styles.filter, filter === "key" && styles.filterOn]
              .filter(Boolean)
              .join(" ")}
            onClick={() => onFilterChange("key")}
          >
            Key
          </button>
        </div>
      </div>

      <div className={styles.timeline} ref={listRef}>
        <div className={styles.spine} aria-hidden="true" />
        <div className={styles.rows}>
          {shown.length === 0 && (
            <p className={styles.empty}>No key moments — a clean, even game.</p>
          )}
          {shown.map((m) => {
            const meta = TAG_META[m.tag];
            const isCurrent = m.ply === current;
            const annotation = annotations?.[m.n] ?? m.label;
            return (
              <button
                key={m.n}
                type="button"
                ref={isCurrent ? activeRef : undefined}
                className={[styles.row, isCurrent && styles.rowCurrent]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => onScrub(m.ply)}
                aria-current={isCurrent ? "true" : undefined}
              >
                <span
                  className={styles.node}
                  style={{
                    background: meta ? meta.color : "var(--surface-3)",
                  }}
                  aria-hidden="true"
                />
                <span className={styles.num}>
                  <span
                    className={styles.dot}
                    style={{
                      background: m.player === "c" ? "var(--coral)" : "var(--aqua)",
                    }}
                  />
                  {String(m.n).padStart(2, "0")}
                </span>
                <span
                  className={[styles.move, meta ? styles.moveTagged : ""]
                    .filter(Boolean)
                    .join(" ")}
                >
                  col {m.col + 1}
                  {annotation && <span className={styles.label}> · {annotation}</span>}
                </span>
                {meta && (
                  <span className={styles.tag} style={{ color: meta.color }}>
                    {meta.label}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
