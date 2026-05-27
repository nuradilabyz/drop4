/**
 * Pure post-game analysis for the AI Coach.
 *
 * `analyzeMatch(movelist, opts?)` runs the engine's per-ply `analyzeGame` and
 * layers on the *coaching* interpretation the UI + LLM need: per-move quality
 * tags (brilliant / fork / good / inaccuracy / miss / blunder / normal),
 * missed-threat flags, per-side accuracy & best-move counts, an eval-bar series
 * from player-1 ('c') POV, and the key moments of the game.
 *
 * This is dependency-free of the DOM / Worker and safe to run on the server
 * (the `/api/coach` route imports it) or in the browser. It calls only the
 * re-exported pure engine helpers.
 */

import {
  analyzeGame,
  detectThreats,
  type MoveEval,
} from "@/engine";
import {
  createBoard,
  drop,
  winningLineAt,
  ROWS,
  type Cells,
  type Player,
} from "@/engine/types";

/** Magnitude above which an eval represents a forced (mate) result. Mirrors
 * the engine: search returns `±WIN_CP + mateDistance` for decided lines and the
 * clamped heuristic stays below MATE_THRESHOLD (90000). */
const MATE_THRESHOLD = 90000;

/** Coach move quality tag. `normal` = unremarkable; the others map to the
 * timeline chips in the design. */
export type MoveTag =
  | "brilliant"
  | "fork"
  | "good"
  | "inaccuracy"
  | "miss"
  | "blunder"
  | "normal";

/** Centipawn-loss thresholds for the quality bands (mover POV). */
export const LOSS_THRESHOLDS = {
  /** < this → "good" */
  good: 25,
  /** < this → "inaccuracy" */
  inaccuracy: 75,
  /** < this → "miss"; ≥ this → "blunder" */
  miss: 200,
} as const;

/** One analyzed move = the raw engine eval + the coach's interpretation. */
export interface AnalyzedMove extends MoveEval {
  /** 1-indexed move number (ply + 1), as shown in the timeline. */
  n: number;
  /** Coach quality tag derived from `lossCp` + fork/brilliant detection. */
  tag: MoveTag;
  /** This move created ≥2 simultaneous winning threats for the mover. */
  createdFork: boolean;
  /** Before the move the opponent had an immediately-winning threat the mover
   * failed to block (and didn't win outright). */
  missedThreat: boolean;
  /** Convenience: position is a forced win/loss after this move (|eval| huge). */
  isMate: boolean;
  /** Short human label echoed in the timeline ("created fork", "missed threat"…). */
  label: string;
}

/** Per-side aggregate stats. */
export interface SideStats {
  /** 0–100, decaying fn of mean centipawn loss. */
  accuracy: number;
  /** [made, total] best-move count. */
  bestMoves: [number, number];
  /** Number of times this side failed to block an immediate winning threat. */
  missedThreats: number;
  /** Average think time in ms (null if no think_ms provided). */
  avgThinkMs: number | null;
  /** Mean centipawn loss across this side's moves. */
  meanLossCp: number;
}

/** A pivotal moment the coach highlights. */
export interface KeyMoment {
  /** 1-indexed move number. */
  ply: number;
  player: Player;
  kind: MoveTag;
  /** Engine's preferred line from before the move (columns). */
  engineLine: number[];
  /** Eval swing magnitude in centipawns (lossCp, ≥0). */
  evalShift: number;
  col: number;
  bestCol: number;
}

/** Full coach analysis payload (pure math; no narration). */
export interface CoachAnalysis {
  /** Schema version — used as the cache key alongside match_id. */
  version: number;
  /** Per-move analyzed records, in play order. */
  moves: AnalyzedMove[];
  /** Eval per ply from PLAYER-1 ('c') POV, in centipawns. Index 0 = after move 1.
   * Positive = good for 'c' (coral / "you" when you are player 1). */
  evalBar: number[];
  /** Per-side stats keyed by player colour. */
  stats: Record<Player, SideStats>;
  /** Pivotal moments (big swings + brilliancies/forks), most significant first. */
  keyMoments: KeyMoment[];
  /** Total plies analyzed. */
  totalMoves: number;
}

/** Current analysis schema version. Bump when shapes change to bust caches. */
export const COACH_ANALYSIS_VERSION = 1;

export interface AnalyzeOptions {
  /** Per-ply think times (ms), aligned to the movelist. */
  thinkMs?: number[];
  /** Engine search depth override (forwarded to analyzeGame). */
  depth?: number;
  /** Cap on number of key moments returned. */
  maxKeyMoments?: number;
}

/** A forced win/loss eval? */
function isMateEval(cp: number): boolean {
  return Math.abs(cp) >= MATE_THRESHOLD;
}

/** Classify a single move's centipawn loss into a quality band (pre-fork). */
function bandFromLoss(lossCp: number): MoveTag {
  if (lossCp < LOSS_THRESHOLDS.good) return "good";
  if (lossCp < LOSS_THRESHOLDS.inaccuracy) return "inaccuracy";
  if (lossCp < LOSS_THRESHOLDS.miss) return "miss";
  return "blunder";
}

/** Accuracy as a smooth decaying function of mean centipawn loss.
 * 0 cp → 100%, ~50 cp → ~80%, ~150 cp → ~55%, large → tends to ~20%.
 * Uses an exponential decay so the curve matches chess-style accuracy meters. */
function accuracyFromMeanLoss(meanLossCp: number): number {
  const acc = 100 * Math.exp(-meanLossCp / 250);
  return Math.round(Math.max(0, Math.min(100, acc)));
}

/** Whether `forPlayer` has ≥2 distinct winning columns in `cells` (a fork). */
function isForkPosition(cells: Cells, forPlayer: Player): boolean {
  const threats = detectThreats(cells, forPlayer);
  const cols = new Set(threats.map(([c]) => c));
  return cols.size >= 2;
}

/** Number of non-losing replies the mover has — used for "only move" brilliancy.
 * A reply is "non-losing" if, after playing it, the opponent does NOT have an
 * immediate winning move. Cheap: pure threat checks, no search. */
function nonLosingReplyCount(cells: Cells, mover: Player): number {
  const opp: Player = mover === "c" ? "a" : "c";
  let count = 0;
  for (let c = 0; c < cells.length; c++) {
    if ((cells[c]?.length ?? 0) >= ROWS) continue; // column full
    const after = drop(cells, c, mover);
    const landedRow = cells[c]?.length ?? 0;
    // Playing here and winning outright is trivially non-losing.
    if (winningLineAt(after, c, landedRow) !== null) {
      count++;
      continue;
    }
    // Otherwise the reply is safe only if it doesn't hand the opponent an
    // immediate win.
    const oppWins = detectThreats(after, opp).length > 0;
    if (!oppWins) count++;
  }
  return count;
}

/**
 * Analyze a finished (or in-progress) game from its movelist.
 * Returns a `CoachAnalysis` with per-move tags, side stats, eval bar, and key
 * moments. Throws only if the movelist is illegal (propagated from the engine).
 */
export function analyzeMatch(
  movelist: number[],
  opts: AnalyzeOptions = {},
): CoachAnalysis {
  const perMove: MoveEval[] = analyzeGame(movelist, opts.depth);

  const moves: AnalyzedMove[] = [];
  const evalBar: number[] = [];

  // Replay alongside the engine evals so we can run threat/fork checks on the
  // pre- and post-move positions.
  let cells: Cells = createBoard();
  let player: Player = "c";

  for (let i = 0; i < perMove.length; i++) {
    const ev = perMove[i];
    const col = ev.col;

    // Pre-move position checks: did the opponent threaten an immediate win that
    // this mover needed to block?
    const opp: Player = player === "c" ? "a" : "c";
    const oppThreatsBefore = detectThreats(cells, opp);
    const oppHadWin = oppThreatsBefore.length > 0;

    // Apply the move.
    const after: Cells = drop(cells, col, player);

    // Did the mover themselves complete a four (i.e. win) with this move?
    const landedRow = (cells[col]?.length ?? 0); // row the new disc occupies
    const moverWonNow = winningLineAt(after, col, landedRow) !== null;

    // Post-move fork: mover now has ≥2 winning columns.
    const createdFork = isForkPosition(after, player);

    // Missed threat: opponent had an immediate win before, the mover did not
    // block it (still has a winning reply for the opponent after the move) and
    // did not win outright themselves.
    const oppStillWins = detectThreats(after, opp).length > 0;
    const missedThreat = oppHadWin && oppStillWins && !moverWonNow;

    // Base band from centipawn loss.
    let tag: MoveTag = bandFromLoss(ev.lossCp);

    // "Near best" = effectively no centipawn loss (used for brilliancy gating).
    const nearBest = ev.lossCp < LOSS_THRESHOLDS.good;

    // Fork upgrade: a forking move that isn't a blunder is at least "fork".
    if (createdFork && ev.lossCp < LOSS_THRESHOLDS.inaccuracy) {
      tag = "fork";
    }

    // Brilliant: best move (≈0 loss) that ALSO creates a fork OR is the only
    // non-losing reply available.
    if (nearBest) {
      const onlyMove = nonLosingReplyCount(cells, player) <= 1;
      if (createdFork || (onlyMove && oppHadWin)) {
        tag = "brilliant";
      }
    }

    // A missed immediate-win block is at best a miss (often a blunder by loss).
    if (missedThreat && (tag === "good" || tag === "inaccuracy" || tag === "fork")) {
      tag = "miss";
    }

    const label = labelFor(tag, missedThreat, createdFork, nearBest);

    moves.push({
      ...ev,
      n: ev.ply + 1,
      tag,
      createdFork,
      missedThreat,
      isMate: isMateEval(ev.evalAfter),
      label,
    });

    // Eval bar from player-1 ('c') POV: evalAfter is mover POV → flip for 'a'.
    const cPov = player === "c" ? ev.evalAfter : -ev.evalAfter;
    evalBar.push(clampEvalForBar(cPov));

    // Advance.
    cells = after;
    player = player === "c" ? "a" : "c";
  }

  const stats = computeSideStats(moves, opts.thinkMs);
  const keyMoments = computeKeyMoments(moves, opts.maxKeyMoments ?? 6);

  return {
    version: COACH_ANALYSIS_VERSION,
    moves,
    evalBar,
    stats,
    keyMoments,
    totalMoves: moves.length,
  };
}

/** Clamp an eval (cp) for the bar so mate scores render as a finite tall bar
 * rather than ±100000. Forced results map to ±2000 (≈ "huge" on the bar). */
function clampEvalForBar(cp: number): number {
  if (isMateEval(cp)) return cp > 0 ? 2000 : -2000;
  return cp;
}

/** Short timeline label for a tag. */
function labelFor(
  tag: MoveTag,
  missedThreat: boolean,
  createdFork: boolean,
  nearBest: boolean,
): string {
  if (tag === "brilliant") return createdFork ? "brilliant! created a fork" : "brilliant! only move";
  if (tag === "fork") return "created fork";
  if (tag === "miss") return missedThreat ? "missed threat" : "missed a stronger move";
  if (tag === "blunder") return missedThreat ? "missed winning threat" : "blunder";
  if (tag === "inaccuracy") return "inaccuracy";
  if (tag === "good") return nearBest ? "best move" : "solid";
  return "";
}

/** Aggregate per-side stats. */
function computeSideStats(
  moves: AnalyzedMove[],
  thinkMs?: number[],
): Record<Player, SideStats> {
  const acc: Record<Player, { loss: number[]; best: number; total: number; missed: number; think: number[] }> = {
    c: { loss: [], best: 0, total: 0, missed: 0, think: [] },
    a: { loss: [], best: 0, total: 0, missed: 0, think: [] },
  };

  for (const m of moves) {
    const s = acc[m.player];
    s.loss.push(m.lossCp);
    s.total += 1;
    if (m.lossCp < LOSS_THRESHOLDS.good && m.col === m.bestCol) s.best += 1;
    if (m.missedThreat) s.missed += 1;
    const t = thinkMs?.[m.ply];
    if (typeof t === "number" && t >= 0) s.think.push(t);
  }

  const build = (p: Player): SideStats => {
    const s = acc[p];
    const meanLoss = s.loss.length ? s.loss.reduce((a, b) => a + b, 0) / s.loss.length : 0;
    const avgThink = s.think.length
      ? Math.round(s.think.reduce((a, b) => a + b, 0) / s.think.length)
      : null;
    return {
      accuracy: accuracyFromMeanLoss(meanLoss),
      bestMoves: [s.best, s.total],
      missedThreats: s.missed,
      avgThinkMs: avgThink,
      meanLossCp: Math.round(meanLoss),
    };
  };

  return { c: build("c"), a: build("a") };
}

/** Pick the most instructive moments: every brilliant/fork, plus the largest
 * centipawn swings, de-duplicated and sorted by significance. */
function computeKeyMoments(moves: AnalyzedMove[], cap: number): KeyMoment[] {
  const picked = new Map<number, KeyMoment>();

  const add = (m: AnalyzedMove) => {
    if (picked.has(m.n)) return;
    picked.set(m.n, {
      ply: m.n,
      player: m.player,
      kind: m.tag,
      engineLine: m.bestPv,
      evalShift: m.lossCp,
      col: m.col,
      bestCol: m.bestCol,
    });
  };

  // 1) Always include brilliancies and forks.
  for (const m of moves) {
    if (m.tag === "brilliant" || m.tag === "fork") add(m);
  }

  // 2) Then the biggest swings (misses/blunders), largest lossCp first.
  const bySwing = [...moves]
    .filter((m) => m.tag === "miss" || m.tag === "blunder")
    .sort((a, b) => b.lossCp - a.lossCp);
  for (const m of bySwing) {
    if (picked.size >= cap) break;
    add(m);
  }

  // Sort the final list: brilliant/fork by ply, swings by magnitude — overall
  // by significance (mate/fork/brilliant first, then biggest loss).
  const rank = (k: KeyMoment): number => {
    if (k.kind === "brilliant") return 4;
    if (k.kind === "fork") return 3;
    if (k.kind === "blunder") return 2;
    if (k.kind === "miss") return 1;
    return 0;
  };

  return [...picked.values()]
    .sort((a, b) => rank(b) - rank(a) || b.evalShift - a.evalShift || a.ply - b.ply)
    .slice(0, cap);
}
