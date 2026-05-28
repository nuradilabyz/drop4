"use client";

/**
 * Hero board on the landing page — plays itself.
 *
 * Used to be a frozen `BOARD_HERO` snapshot, which made the product's whole
 * promise ("discs drop, win lines glow") invisible above the fold. We now
 * script a short 11-move game that ends in a coral diagonal four, pace one
 * move every MOVE_MS, hold the win line for WIN_HOLD_MS, then reset.
 *
 * The actual drop animation is owned by `Board` — it watches `cells` for a
 * single-disc change via `findNewDisc` and triggers the `drop4-drop` keyframe.
 * We just feed it new cells; nothing here knows about the animation itself.
 *
 * Politeness:
 * - `prefers-reduced-motion: reduce` skips the loop entirely and shows the
 *   final winning position frozen. The global keyframe killswitch alone is
 *   not enough — it zeroes the disc-fall animation but doesn't stop us from
 *   pushing 11 state updates per cycle, which still flickers.
 * - `document.visibilitychange` pauses the loop on backgrounded tabs so we
 *   don't burn CPU when nobody's looking.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Board } from "@/components/board/Board";
import { Avatar, Chip, Icon } from "@/components/ui";
import { fromMovelist, winningLineForMovelist } from "@/engine/types";
import styles from "@/app/landing.module.css";

// Coral wins on move 11 via the / diagonal (3,0)→(4,1)→(5,2)→(6,3).
// Verified by hand-tracing fromMovelist + winningLineAt; the aqua side is
// deliberately suboptimal (misses the block on move 10) so the game stays
// short and decisive.
const MOVELIST: readonly number[] = [3, 4, 4, 5, 6, 5, 5, 6, 1, 6, 6];

const MOVE_MS = 900;
const WIN_HOLD_MS = 2200;

export function HeroBoard() {
  const [movesPlayed, setMovesPlayed] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const movesRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reducedMotion) {
      // Show the final winning position, frozen.
      movesRef.current = MOVELIST.length;
      setMovesPlayed(MOVELIST.length);
      return;
    }
    if (typeof document === "undefined") return;

    const tick = () => {
      timerRef.current = null;
      if (!visibleRef.current) return; // visibility handler will resume.
      const n = movesRef.current;
      const next = n >= MOVELIST.length ? 0 : n + 1;
      movesRef.current = next;
      setMovesPlayed(next);
      const delay = next === MOVELIST.length ? WIN_HOLD_MS : MOVE_MS;
      timerRef.current = setTimeout(tick, delay);
    };

    const onVis = () => {
      const wasVisible = visibleRef.current;
      visibleRef.current = document.visibilityState === "visible";
      if (!visibleRef.current && timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      } else if (visibleRef.current && !wasVisible && timerRef.current === null) {
        timerRef.current = setTimeout(tick, MOVE_MS);
      }
    };

    visibleRef.current = document.visibilityState === "visible";
    document.addEventListener("visibilitychange", onVis);
    timerRef.current = setTimeout(tick, MOVE_MS);

    return () => {
      document.removeEventListener("visibilitychange", onVis);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = null;
      movesRef.current = 0;
    };
  }, [reducedMotion]);

  const cells = useMemo(
    () => fromMovelist(MOVELIST.slice(0, movesPlayed), "c"),
    [movesPlayed],
  );
  const winLine = useMemo(
    () =>
      movesPlayed === MOVELIST.length
        ? winningLineForMovelist(MOVELIST.slice(0, movesPlayed))
        : null,
    [movesPlayed],
  );
  const nextPlayer: "c" | "a" = movesPlayed % 2 === 0 ? "c" : "a";

  return (
    <div className={styles.heroBoardWrap}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroBoardTilt}>
        <Board
          cells={cells}
          size="lg"
          nextPlayer={nextPlayer}
          winLine={winLine}
          animateDrops={!reducedMotion}
        />

        <div className={`${styles.floatCard} ${styles.floatThinking}`}>
          <Avatar name="Aigerim K." size={28} />
          <div>
            <div className={styles.floatName}>Aigerim · 1882</div>
            <div className={`${styles.floatMeta} mono`}>thinking…</div>
          </div>
          <div className={styles.thinkingDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className={`${styles.floatCard} ${styles.floatBest}`}>
          <div className={styles.bestHead}>
            <span className={styles.bestKicker}>
              <Icon name="bolt" size={10} color="var(--gold)" /> Best move
            </span>
            <Chip tone="gold" size="sm">
              Pro
            </Chip>
          </div>
          <div className={styles.bestValue}>
            <span className={`${styles.bestCol} mono`}>Col 5</span>
            <span className={`${styles.bestScore} mono`}>+2.4</span>
          </div>
        </div>

        <div className={`${styles.floatTurn} mono`}>
          <Icon name="bolt" size={12} color="var(--coral)" />
          <span>Your turn · 0:18</span>
        </div>
      </div>
    </div>
  );
}
