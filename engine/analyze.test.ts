import { describe, it, expect } from "vitest";
import { analyzeGame } from "@/engine/analyze";
import { detectThreats, hasImmediateWin } from "@/engine/threats";
import { createBoard, type Cells, type Player } from "@/engine/types";

function board(spec: Partial<Record<number, Player[]>>): Cells {
  const cells = createBoard();
  for (const k of Object.keys(spec)) {
    const c = Number(k);
    for (const p of spec[c]!) cells[c].push(p);
  }
  return cells;
}

describe("analyzeGame", () => {
  it("produces one MoveEval per ply in order", () => {
    const moves = [3, 3, 4, 2, 5];
    const evals = analyzeGame(moves, 6);
    expect(evals.length).toBe(moves.length);
    evals.forEach((e, i) => {
      expect(e.ply).toBe(i);
      expect(e.col).toBe(moves[i]);
      expect(e.player).toBe(i % 2 === 0 ? "c" : "a");
      expect(e.lossCp).toBeGreaterThanOrEqual(0);
      expect(typeof e.evalBefore).toBe("number");
      expect(typeof e.evalAfter).toBe("number");
      expect(Array.isArray(e.bestPv)).toBe(true);
    });
  });

  it("flags a blunder that throws away a winning move", () => {
    // Game where 'c' has an immediate win but plays elsewhere.
    // Build via movelist: c,a interleaved so that at some ply c could win but doesn't.
    // c plays 0, a 6, c 1, a 5, c 2 (now c threatens col3 win), a 4 (irrelevant),
    // then it's c to move with a win at 3 — but c plays 6 instead (blunder).
    const moves = [0, 6, 1, 5, 2, 4, 6];
    const evals = analyzeGame(moves, 8);
    // The 7th move (ply 6, 'c') should show a large loss since col 3 won.
    const blunder = evals[6];
    expect(blunder.player).toBe("c");
    expect(blunder.bestCol).toBe(3);
    expect(blunder.lossCp).toBeGreaterThan(0);
  });

  it("throws on an illegal movelist", () => {
    // Overflow a single column.
    const moves = [0, 0, 0, 0, 0, 0, 0];
    expect(() => analyzeGame(moves, 4)).toThrow();
  });
});

describe("detectThreats", () => {
  it("returns the open-three completion squares for the player", () => {
    const cells = board({ 1: ["c"], 2: ["c"], 3: ["c"] });
    const threats = detectThreats(cells, "c");
    const cols = threats.map((t) => t[0]).sort((a, b) => a - b);
    expect(cols).toContain(0);
    expect(cols).toContain(4);
    expect(hasImmediateWin(cells, "c")).toBe(true);
  });

  it("only returns immediately-playable threats", () => {
    // 'c' would win at col0 row1 but row0 is empty → not yet playable.
    const cells = board({ 1: ["a", "c"], 2: ["a", "c"], 3: ["a", "c"] });
    // 'c' has three at row1 across cols1-3; completion at col0 row1 and col4 row1
    // both require row0 filled first → no immediately-playable threat there.
    const threats = detectThreats(cells, "c");
    for (const [c, r] of threats) {
      // each returned threat's row must equal current column height
      expect(r).toBe(cells[c].length);
    }
  });
});
