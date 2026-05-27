/**
 * Pure, server-usable full-game analysis.
 *
 * `analyzeGame(moves)` replays a movelist and, for every ply, reports:
 *   - the eval of the position *before* the move (mover POV, cp),
 *   - the eval *after* the move (mover POV, cp),
 *   - the engine's best column in the pre-move position and its eval,
 *   - the best line (PV),
 *   - the centipawn loss vs. the best move.
 *
 * This runs in PLAIN NODE — no Worker, no DOM — because the server-side AI
 * Coach route imports and calls it directly. It also powers the post-game
 * review in the browser (via the worker wrapper).
 *
 * PURE / ISOMORPHIC.
 */

import {
  createBoard,
  drop,
  canDrop,
  type Cells,
  type Movelist,
  type Player,
} from "./types";
import { searchPosition, toEvalCp } from "./search";

/** Per-move evaluation record consumed by the AI Coach. */
export interface MoveEval {
  /** 0-indexed ply. */
  ply: number;
  /** Player who made this move ('c' first). */
  player: Player;
  /** Column actually played (0-indexed). */
  col: number;
  /** Eval (mover POV) of the position BEFORE the move, in centipawns. */
  evalBefore: number;
  /** Eval (mover POV) AFTER the move, in centipawns. */
  evalAfter: number;
  /** Engine's best column in the pre-move position. */
  bestCol: number;
  /** Eval (mover POV) if the best move were played, in centipawns. */
  bestEval: number;
  /** Best line (columns) from the pre-move position. */
  bestPv: number[];
  /** Centipawn loss vs. best: max(0, bestEval - evalAfter). */
  lossCp: number;
}

/** Analysis search depth. Modest so the server route stays responsive. */
const ANALYZE_DEPTH = 8;

/**
 * Analyze a full game from its movelist. Returns one MoveEval per ply, in
 * order. Throws if the movelist contains an illegal move.
 */
export function analyzeGame(moves: Movelist, depth: number = ANALYZE_DEPTH): MoveEval[] {
  const out: MoveEval[] = [];
  let cells: Cells = createBoard();
  let player: Player = "c";

  for (let ply = 0; ply < moves.length; ply++) {
    const col = moves[ply];
    if (!canDrop(cells, col)) {
      throw new Error(`Illegal move at ply ${ply}: column ${col}`);
    }

    // Pre-move analysis (from the mover's POV).
    const { roots, heuristicCp } = searchPosition(cells, depth);
    const best = roots[0];
    const bestCol = best ? best.col : col;
    const bestEval = best ? toEvalCp(best.score, heuristicCp) : heuristicCp;
    const bestPv = best ? best.pv : [];

    // eval before = best achievable mover eval is the engine's read of the
    // position; the "eval of the position before" is the mover's best line.
    const evalBefore = bestEval;

    // Find the actually-played move's score among the roots.
    const played = roots.find((r) => r.col === col);
    let evalAfterMoverPov: number;
    if (played) {
      evalAfterMoverPov = toEvalCp(played.score, heuristicCp);
    } else {
      // Shouldn't happen for a legal move, but guard: re-search after the move.
      const next = drop(cells, col, player);
      const post = searchPosition(next, Math.max(1, depth - 1));
      // post is from opponent POV; negate the opponent's best for our POV.
      const oppBest = post.roots[0];
      evalAfterMoverPov = oppBest
        ? -toEvalCp(oppBest.score, post.heuristicCp)
        : -post.heuristicCp;
    }

    const lossCp = Math.max(0, evalBefore - evalAfterMoverPov);

    out.push({
      ply,
      player,
      col,
      evalBefore,
      evalAfter: evalAfterMoverPov,
      bestCol,
      bestEval,
      bestPv,
      lossCp,
    });

    // Advance the game state.
    cells = drop(cells, col, player);
    player = player === "c" ? "a" : "c";
  }

  return out;
}
