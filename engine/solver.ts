/**
 * Endgame / "weak" solver for the "insane" difficulty.
 *
 * A from-scratch alpha-beta negamax solver over the bitboard that returns the
 * exact game-theoretic value of a position in mate-distance units (Pons
 * scoring): a win in `n` plies scores `(W*H + 1 - n) / 2`, a loss the negative,
 * a draw 0. Includes:
 *   - immediate-win detection,
 *   - "non-losing moves" pruning (never play into the opponent's instant win,
 *     and if the opponent has a winning move we are forced to block it),
 *   - center-first move ordering,
 *   - a transposition table keyed by the unique position key.
 *
 * It is bounded by a node budget so it stays responsive: when the budget is
 * exhausted it throws `SolverBudgetExceeded`, letting search fall back to the
 * heuristic negamax. On a near-empty board the full solve is expensive, so the
 * search layer only invokes the solver once enough discs are on the board.
 *
 * PURE / ISOMORPHIC — no DOM, no Worker, no timers (budget = node count).
 */

import { COLS, ROWS } from "./types";
import {
  type Bitboard,
  B0,
  canPlay,
  play,
  connectedFour,
  winningSpots,
  opponentWinningSpots,
  isFullBB,
  key,
  playableThreatColumns,
} from "./bitboard";

const W = COLS;
const H = ROWS;
const MAX_PLY = W * H; // 42

/** Center-first column ordering. */
export const COLUMN_ORDER: number[] = [3, 2, 4, 1, 5, 0, 6];

export class SolverBudgetExceeded extends Error {
  constructor() {
    super("solver node budget exceeded");
    this.name = "SolverBudgetExceeded";
  }
}

/** Mate-distance score for the side to move winning with `movesPlayed` discs. */
export function winScore(movesPlayed: number): number {
  return Math.floor((W * H + 1 - movesPlayed) / 2);
}

interface TTEntry {
  /** lower-bound flag uses value; we store value + flag. */
  value: number;
  flag: number; // 0 = exact, 1 = lower bound, -1 = upper bound
}

export interface SolveOptions {
  /** Max nodes before bailing (throws SolverBudgetExceeded). */
  nodeBudget?: number;
  /** Shared transposition table (BigInt key → entry). */
  tt?: Map<bigint, TTEntry>;
}

export interface SolveResult {
  /** Exact game-theoretic score (mover POV, mate-distance units). */
  score: number;
  /** Best column. */
  col: number;
  nodes: number;
}

/**
 * Solve the position exactly (game-theoretic). Returns the best move and its
 * exact score. Throws SolverBudgetExceeded if it can't finish in budget.
 */
export function solve(bb: Bitboard, opts: SolveOptions = {}): SolveResult {
  const budget = opts.nodeBudget ?? 8_000_000;
  const tt = opts.tt ?? new Map<bigint, TTEntry>();
  const counter = { nodes: 0 };

  // Immediate win shortcut.
  for (const c of COLUMN_ORDER) {
    if (!canPlay(bb, c)) continue;
    const next = play(bb, c);
    if (connectedFour(next)) {
      return { score: winScore(bb.moves + 1), col: c, nodes: 1 };
    }
  }

  let alpha = -MAX_PLY;
  let beta = MAX_PLY;
  let bestCol = firstLegal(bb);
  let bestScore = -Infinity;

  // Root: evaluate each non-losing move with negamax.
  const moves = orderedNonLosing(bb);
  if (moves.length === 0) {
    // every move loses immediately or board has only losing moves; still must
    // return a legal column.
    return { score: -winScore(bb.moves + 2), col: firstLegal(bb), nodes: 1 };
  }

  for (const c of moves) {
    const next = play(bb, c);
    if (connectedFour(next)) {
      return { score: winScore(bb.moves + 1), col: c, nodes: counter.nodes + 1 };
    }
    const score = -negamax(next, -beta, -alpha, tt, counter, budget);
    if (score > bestScore) {
      bestScore = score;
      bestCol = c;
    }
    if (score > alpha) alpha = score;
  }

  return { score: bestScore, col: bestCol, nodes: counter.nodes };
}

/**
 * Negamax with alpha-beta over exact scores. `bb` = side to move; returns the
 * mover's exact score.
 */
function negamax(
  bb: Bitboard,
  alphaIn: number,
  betaIn: number,
  tt: Map<bigint, TTEntry>,
  counter: { nodes: number },
  budget: number,
): number {
  if (++counter.nodes > budget) throw new SolverBudgetExceeded();

  let alpha = alphaIn;
  let beta = betaIn;

  // Draw: board full.
  if (isFullBB(bb)) return 0;

  // If side to move can win this move, that's the best possible at this depth.
  const winSpots = winningSpots(bb);
  if (winSpots !== B0) {
    return winScore(bb.moves + 1);
  }

  // Upper bound: best we can do is win on our 2nd-from-now move.
  let max = winScore(bb.moves + 2);
  if (beta > max) {
    beta = max;
    if (alpha >= beta) return beta;
  }

  const k = key(bb);
  const entry = tt.get(k);
  if (entry !== undefined) {
    if (entry.flag === 0) return entry.value;
    if (entry.flag === 1 && entry.value > alpha) alpha = entry.value;
    else if (entry.flag === -1 && entry.value < beta) beta = entry.value;
    if (alpha >= beta) return entry.value;
  }

  // Forced response: if opponent threatens an immediate win, we must block it.
  const oppWin = opponentWinningSpots(bb);
  let candidateCols: number[];
  if (oppWin !== B0) {
    // Count opponent threats; if 2+ distinct playable columns, we lose.
    const blocks = playableColumnsFor(bb, oppWin);
    if (blocks.length === 0) {
      // opponent threat exists but not immediately playable — treat as normal
      candidateCols = orderedNonLosing(bb);
    } else if (blocks.length >= 2) {
      // double threat: we cannot block both → we lose next move.
      return -winScore(bb.moves + 2);
    } else {
      // Single forced block. Playing it must not itself create a self-loss.
      candidateCols = blocks;
    }
  } else {
    candidateCols = orderedNonLosing(bb);
  }

  if (candidateCols.length === 0) {
    // all moves lose to an immediate opponent win.
    return -winScore(bb.moves + 2);
  }

  const origAlpha = alpha;
  let best = -MAX_PLY;
  for (const c of candidateCols) {
    const next = play(bb, c);
    const score = -negamax(next, -beta, -alpha, tt, counter, budget);
    if (score > best) best = score;
    if (score > alpha) alpha = score;
    if (alpha >= beta) break; // beta cutoff
  }

  // Store result with bound flag.
  let flag = 0;
  if (best <= origAlpha) flag = -1; // upper bound
  else if (best >= beta) flag = 1; // lower bound
  tt.set(k, { value: best, flag });

  return best;
}

/** Legal moves in center-first order, excluding moves that hand the opponent an immediate win. */
function orderedNonLosing(bb: Bitboard): number[] {
  const out: number[] = [];
  for (const c of COLUMN_ORDER) {
    if (!canPlay(bb, c)) continue;
    const next = play(bb, c);
    // If after our move the opponent (now to move) has an immediate winning
    // square AND it's playable, this move loses — skip it (unless our move was
    // itself a win, which the caller handles before this).
    if (createsOpponentWin(next)) continue;
    out.push(c);
  }
  // If every move is "losing" under this filter, fall back to any legal move
  // so we still return something playable.
  if (out.length === 0) {
    for (const c of COLUMN_ORDER) if (canPlay(bb, c)) out.push(c);
  }
  return out;
}

/** Does the side to move in `bb` have a playable immediate win? */
function createsOpponentWin(bb: Bitboard): boolean {
  const spots = winningSpots(bb);
  if (spots === B0) return false;
  return playableColumnsFor(bb, spots).length > 0;
}

/** Columns where a `spots` bit is the immediate landing square. */
function playableColumnsFor(bb: Bitboard, spots: bigint): number[] {
  return playableThreatColumns(bb, spots);
}

function firstLegal(bb: Bitboard): number {
  for (const c of COLUMN_ORDER) if (canPlay(bb, c)) return c;
  return 3;
}
