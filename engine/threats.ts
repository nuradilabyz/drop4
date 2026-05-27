/**
 * Threat detection.
 *
 * A "threat" is an empty square that, if a given player drops a disc *there
 * right now*, completes a four-in-a-row. `detectThreats` returns the playable
 * squares (the disc must be droppable into that column on the next move — i.e.
 * the landing row matches) that win immediately for `forPlayer`.
 *
 * Feeds the board's threat rings + the "Show threats" feature.
 *
 * PURE / ISOMORPHIC — no DOM, no Worker.
 */

import {
  columnHeight,
  playerToMove,
  type Cells,
  type Coord,
  type Player,
} from "./types";
import {
  fromCells,
  winningSpots,
  opponentWinningSpots,
  spotsToCoords,
  playableThreatColumns,
  type Bitboard,
} from "./bitboard";

/**
 * Squares that complete a four for `forPlayer`. By default `forPlayer` is the
 * side to move. Only returns *immediately playable* threats: the square's row
 * must equal the current column height (the disc would actually land there).
 */
export function detectThreats(cells: Cells, forPlayer?: Player): Coord[] {
  const mover = playerToMove(cells);
  const player = forPlayer ?? mover;

  // Build the bitboard from `player`'s perspective so `winningSpots` reports
  // squares where `player` completes a four.
  const bb = fromCells(cells, player);
  const spots = winningSpots(bb);

  // Keep only spots that are immediately playable (landing row == height).
  return spotsToCoords(spots).filter(([c, r]) => columnHeight(cells, c) === r);
}

/**
 * All four-completing squares for `forPlayer` regardless of whether they're
 * immediately reachable this turn (includes "stacked" future threats). Used by
 * the eval / parity logic, not the UI rings.
 */
export function allThreatSquares(cells: Cells, forPlayer: Player): Coord[] {
  const bb = fromCells(cells, forPlayer);
  return spotsToCoords(winningSpots(bb));
}

/**
 * Convenience: does `forPlayer` have at least one immediately-winning move?
 */
export function hasImmediateWin(cells: Cells, forPlayer?: Player): boolean {
  return detectThreats(cells, forPlayer).length > 0;
}

/**
 * Squares the side-to-move must respond to: opponent's immediately-playable
 * winning squares. If more than one distinct column is returned, the position
 * is lost (double threat).
 */
export function detectImmediateLosses(cells: Cells): Coord[] {
  const mover = playerToMove(cells);
  const opp: Player = mover === "c" ? "a" : "c";
  return detectThreats(cells, opp);
}

// ── Bitboard-level helpers (used by eval/search internally) ─────────

/** Count of distinct columns where `bb`'s side-to-move can win right now. */
export function immediateWinColumns(bb: Bitboard): number {
  return playableThreatColumns(bb, winningSpots(bb)).length;
}

/** Count distinct opponent immediate winning columns for `bb`. */
export function immediateLossColumns(bb: Bitboard): number {
  return playableThreatColumns(bb, opponentWinningSpots(bb)).length;
}
