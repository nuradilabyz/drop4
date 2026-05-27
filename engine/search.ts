/**
 * Negamax + alpha-beta search with move ordering, a transposition table, and
 * difficulty policies.
 *
 * Terminal wins are scored in mate-distance units (Pons scoring):
 *   win in n plies → score = (W*H + 1 - n) / 2,
 * so faster wins / slower losses are preferred. Non-terminal leaves use the
 * static `evaluate` heuristic, scaled down so it never overlaps the decisive
 * mate band.
 *
 * Difficulty policies:
 *   easy   — shallow (depth 2) + weighted randomness / occasional suboptimal
 *            move, but still takes an immediate win and blocks an immediate
 *            loss most of the time.
 *   normal — depth 6, mild randomness among near-equal moves.
 *   hard   — depth 9, no randomness.
 *   insane — iterative deepening to depth ~12, then a solver-backed exact
 *            endgame once the position is shallow enough; true best play.
 *
 * PURE / ISOMORPHIC — no DOM, no Worker, no wall-clock dependence for
 * determinism (an optional RNG is injectable for the random policies; default
 * uses Math.random).
 */

import {
  COLS,
  ROWS,
  playerToMove,
  type Cells,
  type Difficulty,
  type Player,
  type SearchResult,
} from "./types";
import {
  type Bitboard,
  B0,
  fromCells,
  toCells,
  canPlay,
  play,
  connectedFour,
  winningSpots,
  isFullBB,
  key,
  playableThreatColumns,
} from "./bitboard";
import { evaluate, WIN_CP } from "./eval";
import { solve, SolverBudgetExceeded, COLUMN_ORDER } from "./solver";

const W = COLS;
const H = ROWS;

/**
 * Internal mate scoring (distinct from the solver's compact scoring so the
 * heuristic band fits underneath cleanly):
 *   - a win after `moves` total discs scores `MATE_VALUE - moves`, so a *faster*
 *     win scores higher (fewer discs played) and a slower loss scores higher
 *     for the loser.
 *   - heuristic leaf values are clamped well below MATE_THRESHOLD so they can
 *     never masquerade as a forced result.
 */
const MATE_VALUE = 100000;
/** |score| above this ⇒ the line is a forced win/loss (mate band). */
const MATE_THRESHOLD = 90000;
/** Hard cap for the clamped static heuristic (must stay < MATE_THRESHOLD). */
const HEURISTIC_CAP = 50000;

/** Internal mate-distance win score for the side to move after `moves` discs. */
function mateWin(moves: number): number {
  return MATE_VALUE - moves;
}

interface TTEntry {
  depth: number;
  value: number;
  flag: number; // 0 exact, 1 lower, -1 upper
  bestCol: number;
}

interface SearchContext {
  tt: Map<bigint, TTEntry>;
  nodes: number;
  killers: number[][]; // killers[ply] = [col, col]
}

function newContext(): SearchContext {
  return { tt: new Map(), nodes: 0, killers: [] };
}

/**
 * Convert a mate-distance negamax score to a centipawn-like eval-bar value
 * (mover POV). Decisive scores map to large ± values that scale with distance
 * to mate so the bar still "leans" toward faster mates.
 */
function scoreToCp(score: number, _heuristicCp: number): number {
  if (score > MATE_THRESHOLD) {
    // Forced win: large positive, scaled so a faster mate reads higher.
    return WIN_CP + (score - MATE_THRESHOLD);
  }
  if (score < -MATE_THRESHOLD) {
    return -WIN_CP + (score + MATE_THRESHOLD);
  }
  // Non-decisive: the negamax score is already a centipawn-scale heuristic
  // (clamped static eval propagated minimax-style), so report it directly.
  return Math.round(score);
}

/**
 * Core negamax with alpha-beta. Returns mover's score in mate-distance units
 * for terminal lines, otherwise a scaled heuristic value kept strictly inside
 * (-MATE_THRESHOLD, +MATE_THRESHOLD).
 */
function negamax(
  bb: Bitboard,
  depth: number,
  alphaIn: number,
  betaIn: number,
  ply: number,
  toMove: Player,
  ctx: SearchContext,
): number {
  ctx.nodes++;
  let alpha = alphaIn;
  let beta = betaIn;

  // Immediate win for side to move?
  if (winningSpots(bb) !== B0) {
    return mateWin(bb.moves + 1);
  }
  if (isFullBB(bb)) return 0;
  if (depth === 0) {
    // Heuristic leaf. evaluate() takes Cells+toMove; convert lazily.
    return clampHeuristic(heuristicScore(bb, toMove));
  }

  const k = key(bb);
  const entry = ctx.tt.get(k);
  let ttBest = -1;
  if (entry !== undefined && entry.depth >= depth) {
    if (entry.flag === 0) return entry.value;
    if (entry.flag === 1 && entry.value > alpha) alpha = entry.value;
    else if (entry.flag === -1 && entry.value < beta) beta = entry.value;
    if (alpha >= beta) return entry.value;
  }
  if (entry !== undefined) ttBest = entry.bestCol;

  const moves = orderMoves(bb, ctx, ply, ttBest);

  const origAlpha = alpha;
  let best = -Infinity;
  let bestCol = moves.length > 0 ? moves[0] : 3;
  const childMover: Player = toMove === "c" ? "a" : "c";

  for (const c of moves) {
    const next = play(bb, c);
    let score: number;
    if (connectedFour(next)) {
      // We (current mover) just won.
      score = mateWin(bb.moves + 1);
    } else {
      score = -negamax(next, depth - 1, -beta, -alpha, ply + 1, childMover, ctx);
    }
    if (score > best) {
      best = score;
      bestCol = c;
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      recordKiller(ctx, ply, c);
      break;
    }
  }

  let flag = 0;
  if (best <= origAlpha) flag = -1;
  else if (best >= beta) flag = 1;
  ctx.tt.set(k, { depth, value: best, flag, bestCol });

  return best;
}

function clampHeuristic(cp: number): number {
  // Keep the static heuristic strictly inside the mate band so it never
  // masquerades as a forced result. cp is already a centipawn-like float.
  if (cp > HEURISTIC_CAP) return HEURISTIC_CAP;
  if (cp < -HEURISTIC_CAP) return -HEURISTIC_CAP;
  return cp;
}

function heuristicScore(bb: Bitboard, toMove: Player): number {
  // Reconstruct a Cells view for evaluate() (only runs at leaves).
  const cells = toCells(bb, toMove);
  return evaluate(cells, toMove);
}

function orderMoves(bb: Bitboard, ctx: SearchContext, ply: number, ttBest: number): number[] {
  const legal: number[] = [];
  for (const c of COLUMN_ORDER) if (canPlay(bb, c)) legal.push(c);

  // Prioritise: TT best, then killers, then center order.
  const killers = ctx.killers[ply] ?? [];
  legal.sort((a, b) => prio(b) - prio(a));
  function prio(c: number): number {
    let p = 0;
    if (c === ttBest) p += 1000;
    if (killers.includes(c)) p += 100;
    // center weight (lower COLUMN_ORDER index = more central = higher prio)
    p += 10 - COLUMN_ORDER.indexOf(c);
    return p;
  }
  return legal;
}

function recordKiller(ctx: SearchContext, ply: number, col: number): void {
  const arr = ctx.killers[ply] ?? (ctx.killers[ply] = []);
  if (arr[0] !== col) {
    arr[1] = arr[0];
    arr[0] = col;
  }
}

// ── Root search: evaluate each move, return ranked results ──────────

interface RootMove {
  col: number;
  score: number;
  pv: number[];
}

/**
 * Search the root to a fixed depth and return every legal move with its score
 * and principal variation, sorted best-first.
 */
function searchRoot(bb: Bitboard, depth: number, toMove: Player, ctx: SearchContext): RootMove[] {
  const results: RootMove[] = [];
  const childMover: Player = toMove === "c" ? "a" : "c";

  // Immediate win at root → that move dominates.
  for (const c of COLUMN_ORDER) {
    if (!canPlay(bb, c)) continue;
    const next = play(bb, c);
    if (connectedFour(next)) {
      return [{ col: c, score: mateWin(bb.moves + 1), pv: [c] }];
    }
  }

  const ttBest = ctx.tt.get(key(bb))?.bestCol ?? -1;
  const moves = orderMoves(bb, ctx, 0, ttBest);

  // Principal-variation search at the root: the first (best-ordered) move is
  // searched with a full window for an exact score; each later move is probed
  // with a null window and only re-searched (full) if it beats the running
  // best. This keeps alpha-beta pruning effective (deep searches stay fast)
  // while guaranteeing the chosen best move has an exact, comparable score.
  let alpha = -Infinity;
  let first = true;
  for (const c of moves) {
    const next = play(bb, c);
    let score: number;
    if (connectedFour(next)) {
      score = mateWin(bb.moves + 1);
    } else if (first) {
      score = -negamax(next, depth - 1, -Infinity, Infinity, 1, childMover, ctx);
    } else {
      // Null-window probe.
      score = -negamax(next, depth - 1, -alpha - 1, -alpha, 1, childMover, ctx);
      if (score > alpha) {
        // Improvement — re-search with the full window for an exact value.
        score = -negamax(next, depth - 1, -Infinity, -alpha, 1, childMover, ctx);
      }
    }
    first = false;
    if (score > alpha) alpha = score;
    results.push({ col: c, score, pv: [c, ...extractPv(next, depth - 1, childMover, ctx)] });
  }

  // Sort best-first; break exact ties toward the centre (COLUMN_ORDER index).
  results.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return COLUMN_ORDER.indexOf(a.col) - COLUMN_ORDER.indexOf(b.col);
  });
  return results;
}

/** Walk the TT to extract the principal variation. */
function extractPv(bb: Bitboard, depth: number, _toMove: Player, ctx: SearchContext): number[] {
  const pv: number[] = [];
  let cur = bb;
  let d = depth;
  const seen = new Set<bigint>();
  while (d > 0) {
    if (isFullBB(cur)) break;
    if (winningSpots(cur) !== B0) {
      // winning move exists; find it
      for (const c of COLUMN_ORDER) {
        if (!canPlay(cur, c)) continue;
        const n = play(cur, c);
        if (connectedFour(n)) {
          pv.push(c);
          return pv;
        }
      }
    }
    const k = key(cur);
    if (seen.has(k)) break;
    seen.add(k);
    const e = ctx.tt.get(k);
    if (!e || e.bestCol < 0 || !canPlay(cur, e.bestCol)) break;
    pv.push(e.bestCol);
    cur = play(cur, e.bestCol);
    d--;
  }
  return pv;
}

// ── Difficulty configuration ────────────────────────────────────────

interface Policy {
  depth: number;
  /** Random "slack" in cp: moves within this of the best are eligible for random pick. */
  slack: number;
  /** Probability of deliberately picking a non-best (but eligible) move. */
  randomness: number;
  /** Probability easy will *miss* an otherwise-forced win/block (humanise). */
  blunderChance: number;
  /** Whether to engage the exact solver in the endgame. */
  useSolver: boolean;
  /** Iterative deepening (insane). */
  iterative: boolean;
}

const POLICIES: Record<Difficulty, Policy> = {
  easy: { depth: 2, slack: 80, randomness: 0.55, blunderChance: 0.18, useSolver: false, iterative: false },
  normal: { depth: 6, slack: 25, randomness: 0.18, blunderChance: 0, useSolver: false, iterative: false },
  hard: { depth: 9, slack: 0, randomness: 0, blunderChance: 0, useSolver: false, iterative: false },
  insane: { depth: 12, slack: 0, randomness: 0, blunderChance: 0, useSolver: true, iterative: true },
};

export interface ChooseOptions {
  /** Injectable RNG for deterministic tests; defaults to Math.random. */
  rng?: () => number;
  /** Override solver node budget. */
  solverBudget?: number;
}

/**
 * Choose a move for `cells` at the given `difficulty`, applying that
 * difficulty's depth + randomness policy. Returns a full SearchResult.
 */
export function chooseMove(cells: Cells, difficulty: Difficulty, opts: ChooseOptions = {}): SearchResult {
  const rng = opts.rng ?? Math.random;
  const toMove = playerToMove(cells);
  const bb = fromCells(cells, toMove);
  const policy = POLICIES[difficulty];

  // No legal moves (full board) — degenerate; return a safe default.
  let anyLegal = false;
  for (let c = 0; c < COLS; c++) if (canPlay(bb, c)) { anyLegal = true; break; }
  if (!anyLegal) {
    return { bestCol: 3, score: 0, evalCp: 0, pv: [], depth: 0 };
  }

  const heuristicCp = Math.round(evaluate(cells, toMove));

  // insane: try the exact solver in the endgame, else iterative deepening.
  if (policy.useSolver && bb.moves >= 14) {
    try {
      const tt = new Map();
      const res = solve(bb, { nodeBudget: opts.solverBudget ?? 6_000_000, tt });
      // The solver uses compact mate-distance scoring (±1..21, 0 = draw).
      // Lift a decisive result into the search's mate band for the eval bar.
      let evalCp: number;
      if (res.score > 0) evalCp = WIN_CP + res.score;
      else if (res.score < 0) evalCp = -WIN_CP + res.score;
      else evalCp = 0; // drawn with best play
      return {
        bestCol: res.col,
        score: res.score,
        evalCp,
        pv: [res.col],
        depth: W * H - bb.moves,
      };
    } catch (e) {
      if (!(e instanceof SolverBudgetExceeded)) throw e;
      // fall through to bounded search
    }
  }

  const ctx = newContext();
  let roots: RootMove[];
  if (policy.iterative) {
    roots = iterativeDeepening(bb, policy.depth, toMove, ctx);
  } else {
    roots = searchRoot(bb, policy.depth, toMove, ctx);
  }

  const best = roots[0];

  // ── Difficulty policy: randomness / blunder ──
  let chosen = best;

  if (policy.blunderChance > 0 && rng() < policy.blunderChance && roots.length > 1) {
    // Deliberately pick a worse-but-not-instantly-losing move sometimes
    // (humanises easy). Never include moves that hand the opponent an
    // immediate win in the blunder pool.
    const safe = roots.filter((r) => !losesImmediately(bb, r.col));
    const pool = (safe.length > 1 ? safe : roots).slice(1);
    if (pool.length > 0) chosen = pool[Math.floor(rng() * pool.length)];
  } else if (policy.randomness > 0 && rng() < policy.randomness) {
    // Pick randomly among moves within `slack` cp of the best (near-equal).
    const eligible = roots.filter((r) => isNearEqual(r.score, best.score, policy.slack));
    if (eligible.length > 1) chosen = eligible[Math.floor(rng() * eligible.length)];
  }

  // ── Tactical safeguards (apply at every difficulty) ──
  // 1) Never pass up a guaranteed immediate win.
  if (best.score > MATE_THRESHOLD && chosen.score <= MATE_THRESHOLD) {
    chosen = best;
  }
  // 2) Never play into an immediate loss when a non-losing move exists
  //    (i.e. always block an opponent's open winning threat). This keeps even
  //    easy from ignoring an obvious block.
  if (losesImmediately(bb, chosen.col)) {
    const safe = roots.find((r) => !losesImmediately(bb, r.col));
    if (safe) chosen = safe;
  }

  const depthReached = policy.iterative ? policy.depth : policy.depth;
  return {
    bestCol: chosen.col,
    score: chosen.score,
    evalCp: scoreToCp(chosen.score, heuristicCp),
    pv: chosen.pv,
    depth: depthReached,
  };
}

/**
 * True best move with no randomness. Used for the PRO hint. Defaults to "hard"
 * (depth-9, deterministic) so the hint stays responsive even on a near-empty
 * board; pass "insane" for endgame-perfect play once the board is filled in.
 */
export function bestMove(cells: Cells, difficulty: Difficulty = "hard"): SearchResult {
  return chooseMove(cells, difficulty, { rng: () => 0 });
}

/**
 * Iterative deepening for insane: deepen until the target depth, reusing the
 * shared TT between iterations (cheap and improves move ordering). Stops early
 * once a forced win/loss is proven or a soft node budget is hit, so even the
 * near-empty board stays responsive.
 */
function iterativeDeepening(bb: Bitboard, maxDepth: number, toMove: Player, ctx: SearchContext): RootMove[] {
  let roots: RootMove[] = [];
  const NODE_BUDGET = 3_000_000;
  for (let d = 2; d <= maxDepth; d++) {
    roots = searchRoot(bb, d, toMove, ctx);
    if (roots.length > 0 && Math.abs(roots[0].score) > MATE_THRESHOLD) break;
    if (ctx.nodes > NODE_BUDGET) break;
  }
  return roots;
}

function isNearEqual(a: number, b: number, slackCp: number): boolean {
  // Decisive (mate) scores are only near-equal if identical; otherwise compare
  // the centipawn-scale heuristic values directly (1:1 with `slackCp`).
  if (Math.abs(a) > MATE_THRESHOLD || Math.abs(b) > MATE_THRESHOLD) {
    return a === b;
  }
  return Math.abs(a - b) <= slackCp;
}

/** Would playing `col` give the opponent an immediate winning reply? */
function losesImmediately(bb: Bitboard, col: number): boolean {
  if (!canPlay(bb, col)) return true;
  const next = play(bb, col);
  if (connectedFour(next)) return false; // it's a win, not a loss
  // opponent (now to move) has a playable immediate win?
  return playableThreatColumns(next, winningSpots(next)).length > 0;
}

// ── Exposed low-level search (used by analyze.ts) ───────────────────

/**
 * Run a fixed-depth search and return the ranked root moves. Exposed for the
 * analysis module so it can grade every position consistently.
 */
export function searchPosition(cells: Cells, depth: number): {
  toMove: Player;
  roots: RootMove[];
  heuristicCp: number;
} {
  const toMove = playerToMove(cells);
  const bb = fromCells(cells, toMove);
  const ctx = newContext();
  const roots = searchRoot(bb, depth, toMove, ctx);
  return { toMove, roots, heuristicCp: Math.round(evaluate(cells, toMove)) };
}

/** Public helper mapping a search score to eval-bar cp. */
export function toEvalCp(score: number, heuristicCp: number): number {
  return scoreToCp(score, heuristicCp);
}

export { MATE_THRESHOLD };
