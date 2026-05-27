import { describe, it, expect } from "vitest";
import {
  createBoard,
  drop,
  fromMovelist,
  winningLineAt,
  isFull,
  type Cells,
  type Player,
} from "@/engine/types";
import {
  fromCells,
  toCells,
  connectedFour,
  currentHasFour,
  hasFour,
  canPlay,
  play,
  legalMoves,
  isFullBB,
  winningLineCells,
  winningSpots,
} from "@/engine/bitboard";

/** Build Cells from a compact column->players spec for hand-made positions. */
function board(spec: Partial<Record<number, Player[]>>): Cells {
  const cells = createBoard();
  for (const k of Object.keys(spec)) {
    const c = Number(k);
    for (const p of spec[c]!) cells[c].push(p);
  }
  return cells;
}

describe("bitboard <-> cells round trip", () => {
  it("converts an empty board", () => {
    const cells = createBoard();
    const bb = fromCells(cells, "c");
    expect(bb.position).toBe(0n);
    expect(bb.mask).toBe(0n);
    expect(toCells(bb, "c")).toEqual(cells);
  });

  it("round-trips a mixed board preserving colours", () => {
    const cells = board({ 3: ["c", "a", "c"], 2: ["a"], 4: ["c"] });
    const toMove: Player = "a";
    const bb = fromCells(cells, toMove);
    expect(toCells(bb, toMove)).toEqual(cells);
  });
});

describe("connectedFour — all four directions", () => {
  it("detects a horizontal four", () => {
    // 'c' fills cols 0..3 on the bottom row.
    const cells = board({ 0: ["c"], 1: ["c"], 2: ["c"], 3: ["c"] });
    const bb = fromCells(cells, "a"); // 'a' to move, 'c' just made four
    expect(connectedFour(bb)).toBe(true);
    expect(hasFour(bb.position ^ bb.mask)).toBe(true);
  });

  it("detects a vertical four", () => {
    const cells = board({ 2: ["c", "c", "c", "c"] });
    const bb = fromCells(cells, "a");
    expect(connectedFour(bb)).toBe(true);
  });

  it("detects a diagonal ↗ (bottom-left → top-right) four", () => {
    // Classic staircase: (0,0),(1,1),(2,2),(3,3) all 'c'.
    const cells = board({
      0: ["c"],
      1: ["a", "c"],
      2: ["a", "a", "c"],
      3: ["a", "a", "a", "c"],
    });
    const win = winningLineAt(cells, 3, 3);
    expect(win).not.toBeNull();
    const bb = fromCells(cells, "a");
    expect(connectedFour(bb)).toBe(true);
    const line = winningLineCells(bb.position ^ bb.mask);
    expect(line).not.toBeNull();
  });

  it("detects a diagonal ↘ (top-left → bottom-right) four", () => {
    // (0,3),(1,2),(2,1),(3,0) all 'c'.
    const cells = board({
      0: ["a", "a", "a", "c"],
      1: ["a", "a", "c"],
      2: ["a", "c"],
      3: ["c"],
    });
    const bb = fromCells(cells, "a");
    expect(connectedFour(bb)).toBe(true);
  });

  it("does NOT report four on a 3-in-a-row", () => {
    const cells = board({ 0: ["c"], 1: ["c"], 2: ["c"] });
    const bb = fromCells(cells, "a");
    expect(connectedFour(bb)).toBe(false);
  });

  it("currentHasFour reflects the side to move", () => {
    const cells = board({ 0: ["c"], 1: ["c"], 2: ["c"], 3: ["c"] });
    const bbC = fromCells(cells, "c"); // 'c' is position
    expect(currentHasFour(bbC)).toBe(true);
  });
});

describe("legality + play", () => {
  it("canPlay respects column fullness and range", () => {
    const cells = board({ 0: ["c", "a", "c", "a", "c", "a"] }); // col 0 full
    const bb = fromCells(cells, "c");
    expect(canPlay(bb, 0)).toBe(false);
    expect(canPlay(bb, 1)).toBe(true);
    expect(canPlay(bb, -1)).toBe(false);
    expect(canPlay(bb, 7)).toBe(false);
  });

  it("play flips perspective and records a disc", () => {
    const bb0 = fromCells(createBoard(), "c");
    const bb1 = play(bb0, 3); // 'c' drops in col 3
    expect(bb1.moves).toBe(1);
    // After play, side to move is 'a'; the disc belongs to opponent now.
    const cells = toCells(bb1, "a");
    expect(cells[3][0]).toBe("c");
  });

  it("legalMoves lists all open columns", () => {
    const bb = fromCells(createBoard(), "c");
    expect(legalMoves(bb)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });
});

describe("draw detection", () => {
  it("isFullBB true on a packed board with no winner", () => {
    // Build a full board with no four-in-a-row using a known no-win pattern.
    // Column pattern that avoids four: repeat blocks shifted per pair of cols.
    const cells = createBoard();
    // Verified full board (21 'c' + 21 'a') with NO four-in-a-row in any
    // direction — a genuine draw. Columns are bottom..top.
    const pat: Player[][] = [
      ["c", "c", "a", "a", "c", "a"],
      ["a", "a", "c", "a", "c", "c"],
      ["a", "a", "c", "a", "c", "c"],
      ["c", "a", "a", "c", "a", "a"],
      ["a", "c", "a", "c", "a", "c"],
      ["a", "c", "c", "c", "a", "a"],
      ["a", "c", "c", "a", "c", "c"],
    ];
    for (let c = 0; c < 7; c++) for (const p of pat[c]) cells[c].push(p);
    expect(isFull(cells)).toBe(true);
    const bb = fromCells(cells, "c");
    expect(isFullBB(bb)).toBe(true);
    // It's a draw: neither colour has four.
    expect(hasFour(bb.position)).toBe(false);
    expect(hasFour(bb.position ^ bb.mask)).toBe(false);
  });
});

describe("winningSpots", () => {
  it("finds an open-ended three's completing square", () => {
    // 'c' at cols 1,2,3 bottom row → playable wins at col 0 and col 4.
    const cells = board({ 1: ["c"], 2: ["c"], 3: ["c"] });
    const bb = fromCells(cells, "c");
    const spots = winningSpots(bb);
    expect(spots).not.toBe(0n);
  });
});

describe("fromMovelist sanity", () => {
  it("rebuilds and the bitboard agrees", () => {
    const moves = [3, 3, 4, 4, 5, 5]; // no win
    const cells = fromMovelist(moves);
    const bb = fromCells(cells, "c");
    expect(connectedFour(bb)).toBe(false);
    expect(bb.moves).toBe(6);
  });
});
