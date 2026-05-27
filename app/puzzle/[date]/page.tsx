/**
 * Daily puzzle page — `/puzzle/<date>` (where `<date>` may be "today" or an ISO
 * `YYYY-MM-DD`).
 *
 * Server component: resolves the date, loads the puzzle from Supabase
 * `daily_puzzles`, and falls back to a built-in puzzle (derived from
 * `DAILY_PUZZLE` in lib/mockData) when there is no row or no DB configured.
 * Renders the theme + the interactive `<PuzzleSolver>` client island.
 */

import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Nav } from "@/components/layout/Nav";
import { createClient } from "@/lib/supabase/server";
import { DAILY_PUZZLE } from "@/lib/mockData";
import {
  COLS,
  ROWS,
  type Cells,
  type Cell,
  type Player,
} from "@/engine/types";
import { PuzzleSolver, type PuzzleData } from "./PuzzleSolver";
import styles from "./puzzle.module.css";

interface Props {
  params: Promise<{ date: string }>;
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Resolve the `[date]` segment to an ISO date string. "today" → today. */
function resolveDate(seg: string): string {
  if (seg === "today" || !ISO_RE.test(seg)) {
    return new Date().toISOString().slice(0, 10);
  }
  return seg;
}

/** Built-in fallback puzzle (mirrors supabase/seed.sql today's row). */
function fallbackPuzzle(date: string): PuzzleData {
  // 'c' to move can win by completing the bottom row at column 3.
  const cells: Cells = [["c"], ["c"], ["c"], [], ["a"], ["a"], ["a"]];
  return {
    date,
    number: DAILY_PUZZLE.number,
    cells,
    toMove: "c",
    solution: [3],
    theme: DAILY_PUZZLE.title.replace(/\.$/, ""),
    solvedToday: DAILY_PUZZLE.solvedToday,
  };
}

/**
 * Coerce an arbitrary JSON value into a valid 7-column `Cells` board.
 * Returns null if the shape is unusable so the caller can fall back.
 */
function coerceCells(value: unknown): Cells | null {
  if (!Array.isArray(value) || value.length !== COLS) return null;
  const out: Cells = [];
  for (const col of value) {
    if (!Array.isArray(col) || col.length > ROWS) return null;
    const cells: Cell[] = [];
    for (const v of col) {
      if (v === "c" || v === "a") cells.push(v);
      else return null; // unexpected token
    }
    out.push(cells);
  }
  return out;
}

/** Load the puzzle for `date` from Supabase, or null on any miss/error. */
async function loadPuzzle(date: string): Promise<PuzzleData | null> {
  try {
    const db = await createClient();
    const { data, error } = await db
      .from("daily_puzzles")
      .select("date, puzzle_number, cells, to_move, solution, theme, solved_count")
      .eq("date", date)
      .maybeSingle();
    if (error || !data) return null;

    const cells = coerceCells(data.cells);
    if (!cells) return null;

    const toMove: Player = data.to_move === "a" ? "a" : "c";
    return {
      date: data.date,
      number: data.puzzle_number ?? DAILY_PUZZLE.number,
      cells,
      toMove,
      solution: Array.isArray(data.solution) ? data.solution : [],
      theme: data.theme ?? "Find the winning line",
      solvedToday: data.solved_count ?? 0,
    };
  } catch {
    // No DB / missing env / network — caller falls back.
    return null;
  }
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { date } = await params;
  const iso = resolveDate(date);
  const puzzle = (await loadPuzzle(iso)) ?? fallbackPuzzle(iso);
  return {
    title: `Daily Puzzle #${puzzle.number}`,
    description: `${puzzle.theme} — solve today's Drop4 Connect Four puzzle.`,
  };
}

export default async function PuzzlePage({ params }: Props) {
  const { date } = await params;
  const iso = resolveDate(date);
  const puzzle = (await loadPuzzle(iso)) ?? fallbackPuzzle(iso);

  return (
    <>
      <Nav />
      <main className={styles.main}>
        <div className={styles.wrap}>
          <PuzzleSolver puzzle={puzzle} />
        </div>
      </main>
      <Footer />
      <MobileTabBar />
    </>
  );
}
