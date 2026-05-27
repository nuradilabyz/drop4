/**
 * Static position evaluation heuristic (non-terminal positions).
 *
 * Returns a centipawn-like float from the *side-to-move's* point of view:
 * positive = good for the side to move. Components:
 *   - center-column control weight,
 *   - count of "open" 2- and 3-in-a-row windows per side (windows of 4 cells
 *     containing only one colour + empties),
 *   - odd/even threat parity (Connect-Four zugzwang theory: player 1 'c' wants
 *     odd-row threats, player 2 'a' wants even-row threats).
 *
 * Used for the eval bar and as the leaf heuristic when search hits its depth
 * limit before the game is decided.
 *
 * PURE / ISOMORPHIC.
 */

import {
  COLS,
  ROWS,
  type Cells,
  type Player,
} from "./types";
import {
  fromCells,
  spotsToCoords,
  winningSpots,
  type Bitboard,
} from "./bitboard";

/** Magnitude used for a decisive (mate) score in the eval-bar units. */
export const WIN_CP = 100000;

/** Per-cell positional value table (Connect-Four standard: center is best). */
const CELL_VALUE: number[][] = buildCellValues();

function buildCellValues(): number[][] {
  // Number of 4-in-a-row windows passing through each cell — the classic
  // "static value" map (centre cell = 13 lines, corners = 3).
  const v: number[][] = Array.from({ length: COLS }, () => new Array(ROWS).fill(0));
  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      let count = 0;
      for (const [dc, dr] of dirs) {
        // a window of 4 covers this cell if its start offset o in -3..0 keeps
        // all 4 cells on-board.
        for (let o = -3; o <= 0; o++) {
          let ok = true;
          for (let k = 0; k < 4; k++) {
            const cc = c + dc * (o + k);
            const rr = r + dr * (o + k);
            if (cc < 0 || cc >= COLS || rr < 0 || rr >= ROWS) {
              ok = false;
              break;
            }
          }
          if (ok) count++;
        }
      }
      v[c][r] = count;
    }
  }
  return v;
}

/**
 * Evaluate `cells` from the perspective of `toMove` (defaults to the natural
 * side to move). Returns centipawn-like float; does NOT detect terminal wins
 * (search handles those) — assumes a non-terminal position.
 */
export function evaluate(cells: Cells, toMove: Player): number {
  const me = toMove;
  const opp: Player = me === "c" ? "a" : "c";

  let score = 0;

  // 1) Positional cell-value control.
  for (let c = 0; c < COLS; c++) {
    const col = cells[c] ?? [];
    for (let r = 0; r < col.length; r++) {
      const v = col[r];
      if (v === me) score += CELL_VALUE[c][r];
      else if (v === opp) score -= CELL_VALUE[c][r];
    }
  }

  // 2) Open-window counts (2- and 3-in-a-row potential).
  const win = windowScore(cells, me, opp);
  score += win;

  // 3) Threat parity.
  score += parityScore(cells, me);

  // Scale into centipawn-ish range.
  return score * 5;
}

/**
 * Slide every 4-cell window over the board. A window counts for a player if it
 * contains only their discs + empties (no opponent disc). 3 discs + 1 empty is
 * a strong threat; 2 discs + 2 empty is a developing threat.
 */
function windowScore(cells: Cells, me: Player, opp: Player): number {
  const at = (c: number, r: number): Player | null => {
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return null;
    return cells[c]?.[r] ?? null;
  };

  const dirs = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];

  let s = 0;
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      for (const [dc, dr] of dirs) {
        const endC = c + dc * 3;
        const endR = r + dr * 3;
        if (endC < 0 || endC >= COLS || endR < 0 || endR >= ROWS) continue;
        let mine = 0;
        let theirs = 0;
        for (let k = 0; k < 4; k++) {
          const v = at(c + dc * k, r + dr * k);
          if (v === me) mine++;
          else if (v === opp) theirs++;
        }
        if (mine > 0 && theirs > 0) continue; // mixed: dead window
        if (mine === 3) s += 18;
        else if (mine === 2) s += 6;
        else if (mine === 1) s += 1;
        else if (theirs === 3) s -= 18;
        else if (theirs === 2) s -= 6;
        else if (theirs === 1) s -= 1;
      }
    }
  }
  return s;
}

/**
 * Threat parity. In Connect Four, with optimal play the first player ('c')
 * benefits from threats on odd rows (1,3,5 in 1-indexed = rows 0,2,4 here),
 * the second player ('a') from even rows. We reward `me` for having usable
 * future-winning squares (`winningSpots`, including stacked threats) on the
 * parity that favours their colour.
 */
function parityScore(cells: Cells, me: Player): number {
  const opp: Player = me === "c" ? "a" : "c";

  const myBB: Bitboard = fromCells(cells, me);
  const oppBB: Bitboard = fromCells(cells, opp);

  const myThreats = spotsToCoords(winningSpots(myBB));
  const oppThreats = spotsToCoords(winningSpots(oppBB));

  let s = 0;
  // 'c' (player 1) favours odd rows in 1-indexed → row index 0,2,4 (0-indexed
  // even). Standard Connect Four parity: P1 wants threats on rows 1,3,5
  // (1-indexed bottom=1) which are 0-indexed rows 0,2,4. P2 wants 1,3,5
  // 0-indexed (rows 2,4,6). We encode P1='c' favours 0-indexed even rows.
  for (const [, r] of myThreats) {
    const favoured = me === "c" ? r % 2 === 0 : r % 2 === 1;
    s += favoured ? 4 : 2;
  }
  for (const [, r] of oppThreats) {
    const favoured = opp === "c" ? r % 2 === 0 : r % 2 === 1;
    s -= favoured ? 4 : 2;
  }
  return s;
}

/**
 * Eval-bar value in centipawns from the mover's POV, clamped, for UI display.
 * (Search produces mate scores separately; this is just the heuristic.)
 */
export function evalBar(cells: Cells, toMove: Player): number {
  return Math.round(evaluate(cells, toMove));
}
