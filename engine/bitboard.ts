/**
 * Bitboard representation for Connect Four.
 *
 * Classic layout: 7 columns × 7 bits per column (6 playable rows + 1 sentinel
 * top bit) = 49 bits packed into a BigInt. Column `c` occupies bits
 * `c*7 .. c*7+6`, with bit `c*7+r` representing row `r` (row 0 = bottom).
 * The sentinel bit (row 6) is never a disc; it lets diagonal/vertical
 * connected-four shifts avoid wrapping between columns.
 *
 * State is the well-known two-mask encoding:
 *   - `position`: discs belonging to the side *to move*.
 *   - `mask`:     all discs on the board (either colour).
 * The opponent's discs are `position ^ mask`. `play` flips perspective so the
 * representation is always "from the mover's point of view".
 *
 * This module is PURE and ISOMORPHIC — no DOM, no Worker, no Node-only APIs.
 * It runs identically in the browser, the Web Worker, and Node (server).
 *
 * NOTE: the project compiles with `target: ES2017`, where BigInt *literals*
 * (`1n`) are a type error, so this file uses `BigInt(n)` constructor constants
 * (B0/B1/B2/B3) throughout. Runtime behaviour is identical.
 */

import {
  COLS,
  ROWS,
  type Cells,
  type Player,
  type Coord,
} from "./types";

// Shared small BigInt constants (literals like `1n` are disallowed by the
// ES2017 target; constructed values are equivalent).
export const B0 = BigInt(0);
export const B1 = BigInt(1);
export const B2 = BigInt(2);
export const B3 = BigInt(3);

/** Bits stored per column: ROWS playable + 1 sentinel. */
export const H1 = BigInt(ROWS + 1); // 7
/** Total bits used by the board (7*7 = 49). */
export const BOARD_BITS = BigInt(COLS) * H1;

/**
 * Bitboard state. Always interpreted from the side-to-move's perspective:
 * `position` holds the discs of the player whose turn it is.
 */
export interface Bitboard {
  position: bigint;
  mask: bigint;
  /** Number of discs played so far (ply count). */
  moves: number;
}

/**
 * Mask of the bottom cell of each column (row 0). Used to derive the
 * unique transposition key and to find the landing square for a move.
 *   bottom = 0b...0000001_0000001_..._0000001
 */
export const BOTTOM_MASK: bigint = (() => {
  let b = B0;
  for (let c = 0; c < COLS; c++) b |= B1 << (BigInt(c) * H1);
  return b;
})();

/** Mask of all playable cells (excludes the sentinel top bit of each column). */
export const BOARD_MASK: bigint = BOTTOM_MASK * ((B1 << BigInt(ROWS)) - B1);

/** Bottom bit of a single column. */
function bottomBit(col: number): bigint {
  return B1 << (BigInt(col) * H1);
}

/** Top playable bit (row ROWS-1) of a single column. */
function topBit(col: number): bigint {
  return B1 << (BigInt(col) * H1 + BigInt(ROWS - 1));
}

/** Bit for cell (col, row). */
export function cellBit(col: number, row: number): bigint {
  return B1 << (BigInt(col) * H1 + BigInt(row));
}

/** Fresh empty bitboard, side-to-move = whoever the caller treats as `position`. */
export function emptyBitboard(): Bitboard {
  return { position: B0, mask: B0, moves: 0 };
}

/** Can the side to move drop into `col`? (col in range and not full). */
export function canPlay(bb: Bitboard, col: number): boolean {
  if (col < 0 || col >= COLS) return false;
  return (bb.mask & topBit(col)) === B0;
}

/**
 * Play `col` for the side to move and return the new board with perspective
 * flipped (opponent becomes the side to move). No legality check — call
 * `canPlay` first.
 */
export function play(bb: Bitboard, col: number): Bitboard {
  const newMask = bb.mask | (bb.mask + bottomBit(col));
  return {
    // After flipping, the new side-to-move's discs are the old opponent's discs:
    position: bb.position ^ bb.mask,
    mask: newMask,
    moves: bb.moves + 1,
  };
}

/** Columns the side to move may still play. */
export function legalMoves(bb: Bitboard): number[] {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) if (canPlay(bb, c)) out.push(c);
  return out;
}

/** Current height (number of discs) of column `c`. */
export function columnHeightBB(bb: Bitboard, c: number): number {
  let h = 0;
  for (let r = 0; r < ROWS; r++) {
    if ((bb.mask & cellBit(c, r)) !== B0) h = r + 1;
    else break;
  }
  return h;
}

/** Is the board completely full? */
export function isFullBB(bb: Bitboard): boolean {
  return (bb.mask & BOARD_MASK) === BOARD_MASK;
}

/**
 * Branchless connected-four test over a single colour's bit set.
 * Directions encoded as shift amounts:
 *   1 → vertical (within a column, since columns are 7 bits apart this is "up")
 *   7 → horizontal (H1 = one whole column over)
 *   6 → diagonal ↘ (col+1, row-1)
 *   8 → diagonal ↗ (col+1, row+1)
 * For each direction, `m & (m >> d)` keeps pairs; doing it again with `2*d`
 * keeps fours.
 */
export function hasFour(disc: bigint): boolean {
  // vertical (shift 1)
  let m = disc & (disc >> B1);
  if ((m & (m >> B2)) !== B0) return true;
  // horizontal (shift H1 = 7)
  m = disc & (disc >> H1);
  if ((m & (m >> (B2 * H1))) !== B0) return true;
  // diagonal ↘ (shift H1-1 = 6)
  m = disc & (disc >> (H1 - B1));
  if ((m & (m >> (B2 * (H1 - B1)))) !== B0) return true;
  // diagonal ↗ (shift H1+1 = 8)
  m = disc & (disc >> (H1 + B1));
  if ((m & (m >> (B2 * (H1 + B1)))) !== B0) return true;
  return false;
}

/**
 * Does the side that *just moved* (i.e. the opponent of the current
 * side-to-move) have four in a row? Because `play` flips perspective, after a
 * move the just-moved player's discs are `position ^ mask`.
 */
export function connectedFour(bb: Bitboard): boolean {
  return hasFour(bb.position ^ bb.mask);
}

/** Does the side currently to move already have four in a row? */
export function currentHasFour(bb: Bitboard): boolean {
  return hasFour(bb.position);
}

/**
 * Unique, perspective-independent key for transposition tables.
 * `position + mask + bottom_mask` collapses the two masks into one number that
 * is unique per reachable position (standard Pons key). Equivalent here to
 * `mask + bottom_mask + position`.
 */
export function key(bb: Bitboard): bigint {
  return bb.position + bb.mask + BOTTOM_MASK;
}

// ── Cells <-> Bitboard adapters ─────────────────────────────────────

/**
 * Build a bitboard from a `Cells` board with `toMove` as the side to move.
 * `position` is filled with `toMove`'s discs so the engine always reasons from
 * the mover's perspective.
 */
export function fromCells(cells: Cells, toMove: Player): Bitboard {
  let position = B0;
  let mask = B0;
  let moves = 0;
  for (let c = 0; c < COLS; c++) {
    const col = cells[c] ?? [];
    for (let r = 0; r < col.length && r < ROWS; r++) {
      const v = col[r];
      if (!v) continue;
      const bit = cellBit(c, r);
      mask |= bit;
      moves++;
      if (v === toMove) position |= bit;
    }
  }
  return { position, mask, moves };
}

/**
 * Convert a bitboard back to `Cells`. `toMove` says which colour `position`
 * represents so we can re-label discs.
 */
export function toCells(bb: Bitboard, toMove: Player): Cells {
  const other: Player = toMove === "c" ? "a" : "c";
  const cells: Cells = Array.from({ length: COLS }, () => [] as (Player | null)[]) as Cells;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const bit = cellBit(c, r);
      if ((bb.mask & bit) === B0) break; // columns are dense bottom-up
      cells[c].push((bb.position & bit) !== B0 ? toMove : other);
    }
  }
  return cells;
}

/**
 * If the side to move can win immediately, this returns the bitmask of all
 * cells that would complete a four for them. Empty (0) means no instant win.
 */
export function winningSpots(bb: Bitboard): bigint {
  return computeWinningSpots(bb.position, bb.mask);
}

/** Cells where the *opponent* (side not to move) would complete a four. */
export function opponentWinningSpots(bb: Bitboard): bigint {
  return computeWinningSpots(bb.position ^ bb.mask, bb.mask);
}

/**
 * All empty, currently-playable-or-future cells where placing a `disc` stone
 * would make four. (Includes squares not yet reachable — useful for parity
 * threat analysis.)
 */
function computeWinningSpots(disc: bigint, mask: bigint): bigint {
  let r = B0;

  // vertical
  r |= (disc << B1) & (disc << B2) & (disc << B3);

  // horizontal
  let p = (disc << H1) & (disc << (B2 * H1));
  r |= p & (disc << (B3 * H1));
  r |= p & (disc >> H1);
  p = (disc >> H1) & (disc >> (B2 * H1));
  r |= p & (disc >> (B3 * H1));
  r |= p & (disc << H1);

  // diagonal ↗ (shift H1+1 = 8)
  const d1 = H1 + B1;
  p = (disc << d1) & (disc << (B2 * d1));
  r |= p & (disc << (B3 * d1));
  r |= p & (disc >> d1);
  p = (disc >> d1) & (disc >> (B2 * d1));
  r |= p & (disc >> (B3 * d1));
  r |= p & (disc << d1);

  // diagonal ↘ (shift H1-1 = 6)
  const d2 = H1 - B1;
  p = (disc << d2) & (disc << (B2 * d2));
  r |= p & (disc << (B3 * d2));
  r |= p & (disc >> d2);
  p = (disc >> d2) & (disc >> (B2 * d2));
  r |= p & (disc >> (B3 * d2));
  r |= p & (disc << d2);

  // Restrict to legal empty playable squares.
  return r & (BOARD_MASK ^ mask) & BOARD_MASK;
}

/** Bit position (0..48) → [col, row]. */
export function bitToCoord(bitIndex: number): Coord {
  const col = Math.floor(bitIndex / (ROWS + 1));
  const row = bitIndex % (ROWS + 1);
  return [col, row];
}

/** Enumerate set bits of a mask as [col,row] coordinates (playable cells only). */
export function spotsToCoords(spots: bigint): Coord[] {
  const out: Coord[] = [];
  let m = spots & BOARD_MASK;
  let idx = 0;
  while (m !== B0) {
    if ((m & B1) !== B0) {
      const [c, r] = bitToCoord(idx);
      if (r < ROWS) out.push([c, r]);
    }
    m >>= B1;
    idx++;
  }
  return out;
}

/** Columns where a `spots` bit is the immediate landing square in `bb`. */
export function playableThreatColumns(bb: Bitboard, spots: bigint): number[] {
  const cols: number[] = [];
  for (let c = 0; c < COLS; c++) {
    const height = columnHeightBB(bb, c);
    if (height >= ROWS) continue;
    const landing = cellBit(c, height);
    if ((spots & landing & BOARD_MASK) !== B0) cols.push(c);
  }
  return cols;
}

/**
 * The 4 winning coordinates if `disc` (a colour's bit set) has four in a row
 * passing through any line; returns the first such line found, or null.
 */
export function winningLineCells(disc: bigint): Coord[] | null {
  const dirs: Array<[bigint, number, number]> = [
    [B1, 0, 1], // vertical
    [H1, 1, 0], // horizontal
    [H1 + B1, 1, 1], // diagonal ↗
    [H1 - B1, 1, -1], // diagonal ↘
  ];
  for (const [d, dc, dr] of dirs) {
    const m = disc & (disc >> d) & (disc >> (B2 * d)) & (disc >> (B3 * d));
    if (m !== B0) {
      // find lowest set bit = base of the four
      let idx = 0;
      let mm = m;
      while ((mm & B1) === B0) {
        mm >>= B1;
        idx++;
      }
      const [c0, r0] = bitToCoord(idx);
      const line: Coord[] = [];
      for (let i = 0; i < 4; i++) line.push([c0 + dc * i, r0 + dr * i]);
      return line;
    }
  }
  return null;
}
