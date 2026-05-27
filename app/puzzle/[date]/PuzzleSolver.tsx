"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button, Chip, Icon } from "@/components/ui";
import { Board } from "@/components/board/Board";
import {
  canDrop,
  columnHeight,
  drop,
  winningLineAt,
  type Cells,
  type Coord,
  type Player,
} from "@/engine/types";
import { playDrop, playWin, playThreat } from "@/lib/sound";
import styles from "./puzzle.module.css";

/** Puzzle payload passed from the server page (DB row or fallback). */
export interface PuzzleData {
  date: string;
  number: number;
  cells: Cells;
  /** Side to move at the start position. */
  toMove: Player;
  /** Forcing line as column indices, alternating from `toMove`. */
  solution: number[];
  theme: string;
  solvedToday: number;
}

type Status = "playing" | "solved" | "wrong";

const STREAK_KEY = "drop4:puzzle:streak";
const SOLVED_PREFIX = "drop4:puzzle:solved:";

/** Read the persisted streak (SSR-safe). */
function readStreak(): number {
  if (typeof window === "undefined") return 0;
  try {
    const n = Number.parseInt(window.localStorage.getItem(STREAK_KEY) ?? "0", 10);
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

function readSolved(date: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(SOLVED_PREFIX + date) === "1";
  } catch {
    return false;
  }
}

/** Persist a solve for `date` and bump the streak (idempotent per day). */
function persistSolve(date: string): number {
  let streak = readStreak();
  try {
    if (window.localStorage.getItem(SOLVED_PREFIX + date) !== "1") {
      window.localStorage.setItem(SOLVED_PREFIX + date, "1");
      streak += 1;
      window.localStorage.setItem(STREAK_KEY, String(streak));
    }
  } catch {
    // ignore storage errors
  }
  return streak;
}

const OTHER: Record<Player, Player> = { c: "a", a: "c" };

export function PuzzleSolver({ puzzle }: { puzzle: PuzzleData }) {
  // The board the user is currently looking at; resets to the start position.
  const [cells, setCells] = useState<Cells>(puzzle.cells);
  // How many plies of `solution` have been played correctly so far.
  const [ply, setPly] = useState(0);
  const [status, setStatus] = useState<Status>("playing");
  const [winLine, setWinLine] = useState<Coord[] | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [streak, setStreak] = useState(0);
  const [alreadySolved, setAlreadySolved] = useState(false);
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hydrate persisted state after mount (avoids SSR mismatch).
  useEffect(() => {
    setStreak(readStreak());
    const solved = readSolved(puzzle.date);
    setAlreadySolved(solved);
    if (solved) setStatus("solved");
  }, [puzzle.date]);

  useEffect(() => {
    return () => {
      if (replyTimer.current) clearTimeout(replyTimer.current);
    };
  }, []);

  /** Side that is to move at the current `ply` (alternates from puzzle.toMove). */
  const sideToMove: Player = ply % 2 === 0 ? puzzle.toMove : OTHER[puzzle.toMove];

  const reset = useCallback(() => {
    if (replyTimer.current) clearTimeout(replyTimer.current);
    setCells(puzzle.cells);
    setPly(0);
    setWinLine(null);
    setStatus(alreadySolved ? "solved" : "playing");
  }, [puzzle.cells, alreadySolved]);

  // Effective "solved today" count: bump by one once the user solves it now.
  const solvedToday = useMemo(
    () => puzzle.solvedToday + (status === "solved" && !alreadySolved ? 1 : 0),
    [puzzle.solvedToday, status, alreadySolved],
  );

  const finishSolved = useCallback(() => {
    setStatus("solved");
    playWin();
    const s = persistSolve(puzzle.date);
    setStreak(s);
    setAlreadySolved(true);
  }, [puzzle.date]);

  const handleDrop = useCallback(
    (col: number) => {
      if (status === "solved") return;
      if (!canDrop(cells, col)) return;

      const expected = puzzle.solution[ply];

      // No solution data → accept any legal move and check for an immediate win.
      const isCorrect = expected === undefined ? true : col === expected;

      if (!isCorrect) {
        setAttempts((a) => a + 1);
        setStatus("wrong");
        playThreat();
        return;
      }

      const next = drop(cells, col, sideToMove);
      setCells(next);
      playDrop();
      setStatus("playing");

      // Win check on the disc just placed.
      const row = columnHeight(next, col) - 1;
      const line = winningLineAt(next, col, row);
      const nextPly = ply + 1;

      if (line) {
        setWinLine(line);
        finishSolved();
        return;
      }

      // If the full solution line is exhausted with no win, treat as solved
      // (e.g. a "reach this position" puzzle). Otherwise auto-play the forced
      // opponent reply so the user keeps following their line.
      if (nextPly >= puzzle.solution.length) {
        if (puzzle.solution.length > 0) {
          finishSolved();
        } else {
          setPly(nextPly);
        }
        return;
      }

      const replyCol = puzzle.solution[nextPly];
      if (replyCol !== undefined && canDrop(next, replyCol)) {
        const replySide = OTHER[sideToMove];
        replyTimer.current = setTimeout(() => {
          const afterReply = drop(next, replyCol, replySide);
          setCells(afterReply);
          playDrop();
          setPly(nextPly + 1);
        }, 380);
      } else {
        setPly(nextPly);
      }
    },
    [cells, ply, status, sideToMove, puzzle.solution, finishSolved],
  );

  const themeText = puzzle.theme.replace(/\.$/, "");
  const moverLabel = puzzle.toMove === "c" ? "Coral" : "Aqua";

  return (
    <div className={styles.solver}>
      <header className={styles.head}>
        <div className={styles.headTop}>
          <span className={styles.kicker}>Daily Puzzle</span>
          <Chip tone="gold" size="sm">
            <span className="mono">#{puzzle.number}</span>
          </Chip>
        </div>
        <h1 className={styles.title}>{themeText}.</h1>
        <p className={styles.sub}>
          <span className={styles.moverDot} data-mover={puzzle.toMove} />
          {moverLabel} to move — find the forcing line.
        </p>
      </header>

      <div className={styles.boardArea}>
        <Board
          cells={cells}
          size="md"
          nextPlayer={sideToMove}
          winLine={winLine}
          ghosting={status === "solved"}
          onDrop={status === "solved" ? undefined : handleDrop}
          disabled={status === "solved"}
          showColLabels
          aria-label="Daily puzzle board"
        />

        <div
          className={styles.feedback}
          data-status={status}
          role="status"
          aria-live="polite"
        >
          {status === "solved" && (
            <span className={styles.fbRow}>
              <Icon name="cup" size={15} color="var(--gold)" />
              {alreadySolved && attempts === 0
                ? "Already solved today"
                : "Solved! Nicely done."}
            </span>
          )}
          {status === "wrong" && (
            <span className={styles.fbRow}>
              <Icon name="x" size={15} color="var(--danger)" />
              Not the line — try again.
            </span>
          )}
          {status === "playing" && (
            <span className={styles.fbRow}>
              <Icon name="target" size={15} color="var(--text-mute)" />
              Drop a disc to play your move.
            </span>
          )}
        </div>
      </div>

      <footer className={styles.foot}>
        <div className={styles.streaks}>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Streak</span>
            <span className={`${styles.statValue} mono`}>
              {streak}
              <Icon name="flame" size={16} color="var(--coral)" />
            </span>
          </div>
          <div className={styles.statTile}>
            <span className={styles.statLabel}>Solved today</span>
            <span className={`${styles.statValue} mono`}>
              {solvedToday.toLocaleString()}
            </span>
          </div>
        </div>

        <div className={styles.actions}>
          {status !== "solved" && (
            <Button
              variant="ghost"
              size="md"
              icon={<Icon name="refresh" size={14} />}
              onClick={reset}
            >
              Reset
            </Button>
          )}
          <Button
            variant={status === "solved" ? "primary" : "outline"}
            size="md"
            href="/play"
            iconRight={<Icon name="arrow" size={13} />}
          >
            {status === "solved" ? "Play a match" : "Skip to a game"}
          </Button>
        </div>
      </footer>
    </div>
  );
}
