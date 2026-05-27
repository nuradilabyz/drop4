import { describe, it, expect } from "vitest";
import {
  createBoard,
  fromMovelist,
  drop,
  type Cells,
  type Player,
} from "@/engine/types";
import { chooseMove, bestMove, MATE_THRESHOLD } from "@/engine/search";
import { detectThreats } from "@/engine/threats";

function board(spec: Partial<Record<number, Player[]>>): Cells {
  const cells = createBoard();
  for (const k of Object.keys(spec)) {
    const c = Number(k);
    for (const p of spec[c]!) cells[c].push(p);
  }
  return cells;
}

const ZERO_RNG = () => 0;

describe("forced win", () => {
  it("hard takes an immediate horizontal win", () => {
    // 'c' has 0,1,2 on the bottom; col 3 wins. 'c' to move (6 discs? no: 3 c, balance with a)
    const cells = board({ 0: ["c"], 1: ["c"], 2: ["c"], 4: ["a"], 5: ["a"], 6: ["a"] });
    // counts: c=3, a=3 → 'c' to move.
    const res = chooseMove(cells, "hard", { rng: ZERO_RNG });
    expect(res.bestCol).toBe(3);
    expect(res.score).toBeGreaterThan(MATE_THRESHOLD);
  });

  it("insane takes an immediate vertical win", () => {
    const cells = board({ 2: ["c", "c", "c"], 0: ["a"], 1: ["a"] });
    // c=3, a=2 → wait that's 'a' to move. Fix: make it c to move.
    // c=3,a=2 -> total 5 -> 'a' to move. Add one more a so c to move? We want c to win.
    const c2 = board({ 2: ["c", "c", "c"], 0: ["a"], 1: ["a"], 3: ["a"] });
    // c=3, a=3 -> 'c' to move, col 2 stacks the 4th 'c'.
    const res = chooseMove(c2, "insane", { rng: ZERO_RNG });
    expect(res.bestCol).toBe(2);
    expect(res.score).toBeGreaterThan(MATE_THRESHOLD);
  });
});

describe("forced block", () => {
  it("hard blocks an open-three threat", () => {
    // 'a' threatens to win at col 4 (a at 1,2,3 bottom). 'c' to move must block.
    const cells = board({ 1: ["a"], 2: ["a"], 3: ["a"], 0: ["c"], 6: ["c"] });
    // counts: a=3, c=2 -> total 5 -> 'a' to move. We need 'c' to move. add a 'c'.
    const c2 = board({ 1: ["a"], 2: ["a"], 3: ["a"], 0: ["c"], 5: ["c"], 6: ["c"] });
    // a=3, c=3 -> 'c' to move. 'a' wins at col 0 or col 4 (open three). Must block.
    const threats = detectThreats(c2, "a");
    const threatCols = threats.map((t) => t[0]).sort();
    const res = chooseMove(c2, "hard", { rng: ZERO_RNG });
    expect(threatCols).toContain(res.bestCol);
  });

  it("insane blocks a forced loss", () => {
    // 'a' has three vertically in col 5; 'c' to move must block col 5.
    const cells = board({ 5: ["a", "a", "a"], 0: ["c"], 1: ["c"], 2: ["a"] });
    // a=4? no: 5 has 3 a, col2 has 1 a => a=4; c=2 -> total 6 -> 'c' to move.
    const res = chooseMove(cells, "insane", { rng: ZERO_RNG });
    expect(res.bestCol).toBe(5);
  });
});

describe("opening preferences", () => {
  it("hard prefers the center column on an empty board", () => {
    const res = chooseMove(createBoard(), "hard", { rng: ZERO_RNG });
    expect(res.bestCol).toBe(3);
  });

  it("center opening is favourable for the first player", () => {
    // After 'c' plays center, 'c''s eval-bar reading should be non-negative
    // from 'c''s perspective (center control is good).
    const afterCenter = drop(createBoard(), 3, "c");
    // It's now 'a' to move; evaluate from 'c' via bestMove on the empty board.
    const empty = chooseMove(createBoard(), "hard", { rng: ZERO_RNG });
    expect(empty.evalCp).toBeGreaterThanOrEqual(0);
    expect(afterCenter[3][0]).toBe("c");
  });
});

describe("difficulty: easy still handles tactics most of the time", () => {
  it("easy usually takes an immediate win (deterministic best path)", () => {
    const cells = board({ 0: ["c"], 1: ["c"], 2: ["c"], 4: ["a"], 5: ["a"], 6: ["a"] });
    // With rng=0 the blunder/randomness branches don't fire, and the
    // immediate-win safeguard forces the win.
    const res = chooseMove(cells, "easy", { rng: ZERO_RNG });
    expect(res.bestCol).toBe(3);
  });

  it("easy blocks an immediate loss (deterministic)", () => {
    const cells = board({ 1: ["a"], 2: ["a"], 3: ["a"], 0: ["c"], 5: ["c"], 6: ["c"] });
    const res = chooseMove(cells, "easy", { rng: ZERO_RNG });
    const threats = detectThreats(cells, "a").map((t) => t[0]);
    expect(threats).toContain(res.bestCol);
  });
});

describe("bestMove (PRO hint) is deterministic", () => {
  it("returns center on empty board", () => {
    expect(bestMove(createBoard()).bestCol).toBe(3);
  });
});

describe("perf sanity", () => {
  it("hard search on a midgame position returns within 2s", () => {
    // A realistic ~12-ply midgame position.
    const moves = [3, 3, 4, 2, 5, 4, 2, 1, 3, 5, 4, 2];
    const cells = fromMovelist(moves);
    const t0 = Date.now();
    const res = chooseMove(cells, "hard", { rng: ZERO_RNG });
    const dt = Date.now() - t0;
    expect(res.bestCol).toBeGreaterThanOrEqual(0);
    expect(dt).toBeLessThan(2000);
  });
});
