/**
 * Core Connect Four types + pure board helpers.
 *
 * The board vocabulary is fixed by the design (tokens.jsx Board): `cells[col][row]`
 * with `row 0 = bottom`, and disc values `'c'` (coral = player 1) | `'a'`
 * (aqua = player 2) | `null`. Moves are serialized as column-index arrays
 * (`Movelist`), the compact, replayable source of truth stored in the DB.
 *
 * This module is dependency-free and safe to import from the UI, the engine, the
 * Web Worker, and server code (ELO replay, coach analysis) alike.
 */

export const COLS = 7;
export const ROWS = 6;

export type Player = "c" | "a";
export type Cell = Player | null;
/** cells[col][row]; row 0 is the bottom. Columns are dense arrays from the bottom up. */
export type Cells = Cell[][];
/** [col, row] coordinate. */
export type Coord = [number, number];
/** Ordered list of columns played, alternating players starting with 'c'. */
export type Movelist = number[];

export type Difficulty = "easy" | "normal" | "hard" | "insane";

export type GameResult = "c" | "a" | "draw";

/** Move classification used by the coach (eval-delta based). */
export type MoveQuality =
  | "brilliant"
  | "great"
  | "good"
  | "inaccuracy"
  | "miss"
  | "blunder";

export interface SearchResult {
  /** Best column to play (0-indexed). */
  bestCol: number;
  /** Negamax score in mate-distance units (positive = good for side to move). */
  score: number;
  /** Engine evaluation in centipawn-like units for the eval bar (mover's POV). */
  evalCp: number;
  /** Principal variation (columns), best line as far as searched. */
  pv: number[];
  /** Search depth actually reached. */
  depth: number;
}

// ── Pure board helpers ──────────────────────────────────────────────

/** Fresh empty board: 7 empty column arrays. */
export function createBoard(): Cells {
  return Array.from({ length: COLS }, () => []);
}

/** Number of discs currently in a column (= the row index a new disc lands on). */
export function columnHeight(cells: Cells, col: number): number {
  return cells[col]?.length ?? 0;
}

/** Whether a disc can be dropped into `col`. */
export function canDrop(cells: Cells, col: number): boolean {
  return col >= 0 && col < COLS && columnHeight(cells, col) < ROWS;
}

/**
 * Whose turn it is given a board state and the game's starter.
 *
 * Move-count parity tells you the *parity* of the next move, but which player
 * that parity maps to depends on who opened the game. Default `starter = "c"`
 * preserves the original assumption — and the engine's internal callers in
 * search/threats only ever reason about a single hypothetical position so it
 * works unchanged for them. Game-state callers that can face an aqua-started
 * game (e.g. the solo hook after a rematch flips the starter) MUST pass the
 * actual starter, otherwise the player-to-move is wrong on every even move
 * count of an aqua-started game (board locks: human can't click because the
 * `current` derivation reports the AI as still being to move).
 */
export function playerToMove(cells: Cells, starter: Player = "c"): Player {
  const count = cells.reduce((n, c) => n + c.length, 0);
  const opponent: Player = starter === "c" ? "a" : "c";
  return count % 2 === 0 ? starter : opponent;
}

/** Returns a new board with `player`'s disc dropped into `col` (no legality check). */
export function drop(cells: Cells, col: number, player: Player): Cells {
  const next = cells.map((c) => c.slice());
  next[col].push(player);
  return next;
}

/** Rebuild a board from a movelist. Throws on an illegal/overflowing column. */
export function fromMovelist(moves: Movelist): Cells {
  let cells = createBoard();
  let player: Player = "c";
  for (const col of moves) {
    if (!canDrop(cells, col)) {
      throw new Error(`Illegal move: column ${col} is full or out of range`);
    }
    cells = drop(cells, col, player);
    player = player === "c" ? "a" : "c";
  }
  return cells;
}

/** All columns that can still be played. */
export function legalColumns(cells: Cells): number[] {
  const out: number[] = [];
  for (let c = 0; c < COLS; c++) if (canDrop(cells, c)) out.push(c);
  return out;
}

/** Whether the board is completely full (draw if no winner). */
export function isFull(cells: Cells): boolean {
  return cells.every((c) => c.length >= ROWS);
}

const DIRECTIONS: ReadonlyArray<readonly [number, number]> = [
  [1, 0], // horizontal
  [0, 1], // vertical
  [1, 1], // diagonal ↗
  [1, -1], // diagonal ↘
];

/**
 * If the disc at (col,row) completes a line of four, return the 4 winning
 * coordinates; otherwise null. Used for win detection and the win-line glow.
 */
export function winningLineAt(cells: Cells, col: number, row: number): Coord[] | null {
  const player = cells[col]?.[row];
  if (!player) return null;
  for (const [dc, dr] of DIRECTIONS) {
    const line: Coord[] = [[col, row]];
    for (const sign of [1, -1] as const) {
      let c = col + dc * sign;
      let r = row + dr * sign;
      while (c >= 0 && c < COLS && r >= 0 && r < ROWS && cells[c]?.[r] === player) {
        line.push([c, r]);
        c += dc * sign;
        r += dr * sign;
      }
    }
    if (line.length >= 4) {
      // Trim to a contiguous run of exactly 4 through the played disc.
      return sortLine(line, dc, dr).slice(0, 4);
    }
  }
  return null;
}

function sortLine(line: Coord[], dc: number, dr: number): Coord[] {
  const key = ([c, r]: Coord) => c * dc + r * dr;
  return [...line].sort((a, b) => key(a) - key(b));
}

/** Win-line for the last move in a movelist, or null. */
export function winningLineForMovelist(moves: Movelist): Coord[] | null {
  if (moves.length === 0) return null;
  const cells = fromMovelist(moves);
  const lastCol = moves[moves.length - 1];
  const row = columnHeight(cells, lastCol) - 1;
  return winningLineAt(cells, lastCol, row);
}
