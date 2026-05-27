/**
 * Pure Elo rating math. No Supabase / IO imports — safe to unit test and to
 * call from the server-authoritative finalize route.
 *
 * Standard Elo:
 *   expected = 1 / (1 + 10^((rOpp - rSelf) / 400))
 *   newR     = r + K * (score - expected),  score ∈ {1, 0.5, 0}
 *
 * K-factor (per player, based on that player's own games / rating):
 *   - 32 if games < 30        (provisional)
 *   - 24 if elo  < 2100       (established)
 *   - 16 otherwise            (elite)
 */

/** Match outcome from the perspective of "self". */
export type EloResult = "win" | "loss" | "draw";

/** Numeric score for an outcome, from "self"'s perspective. */
export function scoreFor(result: EloResult): number {
  switch (result) {
    case "win":
      return 1;
    case "draw":
      return 0.5;
    case "loss":
      return 0;
  }
}

/** Expected score for `rSelf` against `rOpp` (0..1). */
export function expectedScore(rSelf: number, rOpp: number): number {
  return 1 / (1 + Math.pow(10, (rOpp - rSelf) / 400));
}

/**
 * K-factor for a player given their own current rating and games played.
 * Provisional players (fewer than 30 games) move fastest.
 */
export function kFactor(elo: number, games: number): number {
  if (games < 30) return 32;
  if (elo < 2100) return 24;
  return 16;
}

/**
 * Compute the rating delta (rounded to an integer) to apply to `self` after a
 * single game against `opp`.
 *
 * @param self  { elo, games } for the player whose delta we want.
 * @param opp   { elo } of the opponent.
 * @param result outcome from `self`'s perspective.
 */
export function computeEloDelta(
  self: { elo: number; games: number },
  opp: { elo: number },
  result: EloResult,
): number {
  const expected = expectedScore(self.elo, opp.elo);
  const score = scoreFor(result);
  const k = kFactor(self.elo, self.games);
  return Math.round(k * (score - expected));
}

/** Invert a result to the opponent's perspective. */
export function invertResult(result: EloResult): EloResult {
  if (result === "win") return "loss";
  if (result === "loss") return "win";
  return "draw";
}
