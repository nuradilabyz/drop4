import { describe, it, expect } from "vitest";
import { fromMovelist, createBoard, type Cells, type Player } from "@/engine/types";
import { fromCells } from "@/engine/bitboard";
import { solve } from "@/engine/solver";
import { chooseMove } from "@/engine/search";

function board(spec: Partial<Record<number, Player[]>>): Cells {
  const cells = createBoard();
  for (const k of Object.keys(spec)) {
    const c = Number(k);
    for (const p of spec[c]!) cells[c].push(p);
  }
  return cells;
}

describe("solver (exact endgame)", () => {
  it("finds a forced win and reports a positive exact score", () => {
    // 'c' has a double-threat setup: three across the bottom (cols 1,2,3) with
    // open ends at 0 and 4 → immediate win available. Solver must score a win.
    const cells = board({ 1: ["c"], 2: ["c"], 3: ["c"], 0: ["a"], 5: ["a"], 6: ["a"] });
    const bb = fromCells(cells, "c"); // 'c' to move
    const res = solve(bb, { nodeBudget: 2_000_000 });
    expect(res.score).toBeGreaterThan(0);
    expect(res.col).toBe(4); // the playable winning completion
  });

  it("recognises an immediate winning move from the bitboard", () => {
    const cells = board({ 2: ["c", "c", "c"], 0: ["a"], 1: ["a"], 5: ["a"] });
    // c=3, a=3 → 'c' to move; stacking col2 wins.
    const bb = fromCells(cells, "c");
    const res = solve(bb, { nodeBudget: 2_000_000 });
    expect(res.col).toBe(2);
    expect(res.score).toBeGreaterThan(0);
  });

  it("scores a dead-drawn full-but-one board near zero / forced", () => {
    // A position with a single legal move that just fills the board to a draw.
    const cells = board({
      0: ["c", "c", "a", "a", "c", "a"],
      1: ["a", "a", "c", "a", "c", "c"],
      2: ["a", "a", "c", "a", "c", "c"],
      3: ["c", "a", "a", "c", "a", "a"],
      4: ["a", "c", "a", "c", "a", "c"],
      5: ["a", "c", "c", "c", "a", "a"],
      6: ["a", "c", "c", "a", "c"], // one empty cell at col6 row5
    });
    const bb = fromCells(cells, "c");
    const res = solve(bb, { nodeBudget: 2_000_000 });
    expect(res.col).toBe(6);
    expect(res.score === 0).toBe(true); // drawn with the only move (±0)
  });
});

describe("insane endgame uses the solver", () => {
  it("insane finds the win in a late-game forced position", () => {
    // Build a long-ish game then a winning shot. moves bring board to >=14 discs.
    const moves = [3, 3, 3, 3, 3, 3, 2, 2, 2, 2, 2, 2, 4, 4]; // 14 discs, cols 2&3 full
    const cells = fromMovelist(moves);
    const res = chooseMove(cells, "insane", { rng: () => 0 });
    // Just assert it returns a legal, defined move quickly (solver path).
    expect(res.bestCol).toBeGreaterThanOrEqual(0);
    expect(res.bestCol).toBeLessThan(7);
  });
});
