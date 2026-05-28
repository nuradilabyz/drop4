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

/**
 * Synthetic Elo rating per AI difficulty tier. Used by both the lobby (so the
 * Ranked tile can show the bot's effective rating next to the player's) and
 * the finalize route (so the bot opponent has a real number to compute the
 * delta against). Chess-club analogues: easy ≈ beginner, normal ≈ casual,
 * hard ≈ strong club, insane ≈ master.
 */
export const BOT_ELO_BY_DIFFICULTY: Record<string, number> = {
  easy: 900,
  normal: 1300,
  hard: 1800,
  insane: 2300,
};

/**
 * Human-sounding opponent names per rating tier. Until the real-player queue
 * opens, ranked matches pair the user with an AI standing in for a human of
 * the relevant Elo — so the opponent shouldn't read "Calibrated bot" in the
 * pane. Names are deterministically picked from this pool by the game id, so
 * one match = one stable opponent name, and rematching the same match id
 * keeps the same name.
 */
export const BOT_NAMES_BY_DIFFICULTY: Record<string, readonly string[]> = {
  easy: ["Aibol N.", "Madiyar T.", "Aru K.", "Tolegen S.", "Dilnaz A."],
  normal: ["Daniyar K.", "Aigul T.", "Yerlan B.", "Madina O.", "Sanzhar M."],
  hard: ["Aigerim M.", "Nurlan S.", "Saltanat A.", "Bekzat O.", "Aliya R."],
  insane: ["Dastan K.", "Aizhan B.", "Timur G.", "Aiman D.", "Nursultan G."],
};

/**
 * Deterministically pick a human-sounding opponent name from the difficulty's
 * pool, seeded by the match id so the name doesn't flicker on re-render and
 * the same id always resolves to the same opponent.
 */
export function pickBotName(seed: string, difficulty: string): string {
  const pool =
    BOT_NAMES_BY_DIFFICULTY[difficulty] ?? BOT_NAMES_BY_DIFFICULTY.hard;
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return pool[h % pool.length];
}
