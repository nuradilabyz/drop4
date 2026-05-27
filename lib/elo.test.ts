import { describe, expect, it } from "vitest";
import {
  computeEloDelta,
  expectedScore,
  invertResult,
  kFactor,
  scoreFor,
} from "./elo";

describe("expectedScore", () => {
  it("is 0.5 for equal ratings", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 10);
  });

  it("is symmetric (the pair sums to 1)", () => {
    const a = expectedScore(1600, 1400);
    const b = expectedScore(1400, 1600);
    expect(a + b).toBeCloseTo(1, 10);
  });

  it("rises monotonically with a rating advantage", () => {
    expect(expectedScore(1700, 1500)).toBeGreaterThan(0.5);
    expect(expectedScore(1300, 1500)).toBeLessThan(0.5);
  });

  it("matches the textbook 400-point spread (~0.909)", () => {
    expect(expectedScore(1800, 1400)).toBeCloseTo(0.9090909, 5);
  });
});

describe("kFactor selection", () => {
  it("is 32 while provisional (games < 30)", () => {
    expect(kFactor(1200, 0)).toBe(32);
    expect(kFactor(2500, 29)).toBe(32);
  });

  it("is 24 once established and below 2100", () => {
    expect(kFactor(1200, 30)).toBe(24);
    expect(kFactor(2099, 100)).toBe(24);
  });

  it("is 16 for elite (>= 2100) and established", () => {
    expect(kFactor(2100, 30)).toBe(16);
    expect(kFactor(2400, 500)).toBe(16);
  });
});

describe("scoreFor", () => {
  it("maps outcomes to 1 / 0.5 / 0", () => {
    expect(scoreFor("win")).toBe(1);
    expect(scoreFor("draw")).toBe(0.5);
    expect(scoreFor("loss")).toBe(0);
  });
});

describe("computeEloDelta", () => {
  it("gives equal-rated provisional winner +16 (K=32 * 0.5)", () => {
    const delta = computeEloDelta({ elo: 1500, games: 0 }, { elo: 1500 }, "win");
    expect(delta).toBe(16);
  });

  it("gives equal-rated provisional loser -16", () => {
    const delta = computeEloDelta({ elo: 1500, games: 0 }, { elo: 1500 }, "loss");
    expect(delta).toBe(-16);
  });

  it("is zero for an equal-rated draw", () => {
    const delta = computeEloDelta({ elo: 1500, games: 50 }, { elo: 1500 }, "draw");
    expect(delta).toBe(0);
  });

  it("rewards an upset more than an expected win", () => {
    const underdog = computeEloDelta({ elo: 1400, games: 100 }, { elo: 1800 }, "win");
    const favorite = computeEloDelta({ elo: 1800, games: 100 }, { elo: 1400 }, "win");
    expect(underdog).toBeGreaterThan(favorite);
  });

  it("penalises a favorite who draws against a weaker opponent", () => {
    const delta = computeEloDelta({ elo: 1800, games: 100 }, { elo: 1400 }, "draw");
    expect(delta).toBeLessThan(0);
  });

  it("zero-sum for equal K-factors (winner gain = loser loss)", () => {
    const self = { elo: 1600, games: 100 };
    const opp = { elo: 1500, games: 100 };
    const win = computeEloDelta(self, opp, "win");
    const loss = computeEloDelta(opp, self, "loss");
    // Both established & < 2100 → K=24 for both → exactly opposite (rounding aside).
    expect(win + loss).toBe(0);
  });
});

describe("invertResult", () => {
  it("flips win/loss and preserves draw", () => {
    expect(invertResult("win")).toBe("loss");
    expect(invertResult("loss")).toBe("win");
    expect(invertResult("draw")).toBe("draw");
  });
});
