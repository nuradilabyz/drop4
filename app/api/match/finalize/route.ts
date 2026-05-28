/**
 * Server-authoritative match finalize.
 *
 * The client cannot be trusted to report the winner: we REPLAY the movelist
 * with the shared engine and derive the real result, rejecting impossible
 * claims. For ranked games with two authenticated players we compute Elo with
 * the pure `lib/elo.ts` math and write both profiles + the match atomically
 * using the service-role (admin) client. Solo/duel games are recorded and
 * streak/win counters updated, but only `ranked` moves Elo.
 *
 * Auth: the caller must be authenticated (server session) and be a participant
 * of the match they're finalizing.
 *
 * POST body:
 *   { matchId?, mode, movelist:int[], think_ms?:int[],
 *     player1_id, player2_id?, ai_difficulty?, durationMs }
 */
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  COLS,
  fromMovelist,
  winningLineForMovelist,
  type Cells,
} from "@/engine/types";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  BOT_ELO_BY_DIFFICULTY,
  computeEloDelta,
  invertResult,
  type EloResult,
} from "@/lib/elo";
import type { MatchInsert, MatchResult, ProfileUpdate } from "@/types/database";

export const runtime = "nodejs";

const BodySchema = z.object({
  matchId: z.string().uuid().optional(),
  mode: z.enum(["solo", "duel", "ranked", "puzzle"]),
  movelist: z.array(z.number().int().min(0).max(COLS - 1)).max(COLS * 6),
  think_ms: z.array(z.number().int().nonnegative()).optional(),
  player1_id: z.string().uuid(),
  player2_id: z.string().uuid().nullish(),
  ai_difficulty: z.string().nullish(),
  durationMs: z.number().int().nonnegative(),
});

/** Engine board is full when every column has 6 discs. */
function isBoardFull(cells: Cells): boolean {
  return cells.every((col) => col.length >= 6);
}

/**
 * Replay the movelist and derive the authoritative result.
 * Returns 'p1' | 'p2' | 'draw', or null if the game is unfinished/illegal.
 *
 * 'c' (player 1) always moves first. The last mover is the winner if the final
 * move completed a line of four.
 */
function deriveResult(movelist: number[]): MatchResult | null {
  let cells: Cells;
  try {
    cells = fromMovelist(movelist); // throws on illegal/overflow moves
  } catch {
    return null;
  }

  const line = winningLineForMovelist(movelist);
  if (line) {
    // Last mover wins. Moves alternate c,a,c,... starting with c (player 1).
    const lastIndex = movelist.length - 1;
    return lastIndex % 2 === 0 ? "p1" : "p2";
  }

  if (isBoardFull(cells)) return "draw";

  // No winner and board not full → game isn't actually over.
  return null;
}

export async function POST(request: NextRequest) {
  // ── Parse + validate body ──────────────────────────────────────────
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const body = parsed.data;
  const player2Id = body.player2_id ?? null;

  // ── Auth: caller must be a participant ──────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.id !== body.player1_id && user.id !== player2Id) {
    return NextResponse.json(
      { error: "Caller is not a participant of this match" },
      { status: 403 },
    );
  }

  // ── Server-authoritative result from replaying the movelist ─────────
  const result = deriveResult(body.movelist);
  if (result === null) {
    return NextResponse.json(
      { error: "Movelist does not represent a finished, legal game" },
      { status: 400 },
    );
  }

  // ── Admin (service-role) writes: atomic-as-possible finalize ────────
  const admin = createAdminClient();

  const winnerId =
    result === "p1"
      ? body.player1_id
      : result === "p2"
        ? player2Id
        : null;

  const matchRow: MatchInsert = {
    id: body.matchId,
    mode: body.mode,
    player1_id: body.player1_id,
    player2_id: player2Id,
    ai_difficulty: body.ai_difficulty ?? null,
    result,
    winner_id: winnerId,
    movelist: body.movelist,
    think_ms: body.think_ms ?? null,
    duration_ms: body.durationMs,
    ended_at: new Date().toISOString(),
  };

  // Ranked Elo applies in two shapes:
  //   1. Two real authenticated players  → both profiles move (PvP queue,
  //      not wired yet but route stays ready for it).
  //   2. One real player + the calibrated bot (no player2_id, ai_difficulty
  //      set) → only the human moves, against a synthetic opponent whose Elo
  //      comes from BOT_ELO_BY_DIFFICULTY.
  // The pure Elo math in lib/elo.ts already accounts for the rating gap and
  // the human's own K-factor, so the delta is small for an easy bot, generous
  // for an Insane upset, and properly punishing if a high-Elo player loses
  // to a Normal bot.
  const isRankedPvP = body.mode === "ranked" && !!player2Id;
  const botElo =
    body.mode === "ranked" && !player2Id && body.ai_difficulty
      ? BOT_ELO_BY_DIFFICULTY[body.ai_difficulty]
      : undefined;
  const isRankedSolo = botElo !== undefined;

  let eloDelta: number | null = null;

  if (isRankedSolo) {
    // Single real player vs synthetic bot. Fetch only player1.
    const { data: p1, error: profErr } = await admin
      .from("profiles")
      .select("id, elo, games, wins, losses, draws, streak, best_streak")
      .eq("id", body.player1_id)
      .maybeSingle();
    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }
    if (!p1) {
      return NextResponse.json(
        { error: "Player profile not found" },
        { status: 400 },
      );
    }
    const humanResult: EloResult =
      result === "p1" ? "win" : result === "draw" ? "draw" : "loss";
    const delta = computeEloDelta(
      { elo: p1.elo, games: p1.games },
      { elo: botElo as number },
      humanResult,
    );
    eloDelta = delta;
    matchRow.elo_delta = delta;
    const upd = await applyPlayerUpdate(admin, p1, delta, humanResult);
    if (upd.error) {
      return NextResponse.json(
        { error: `Failed to update profile: ${upd.error.message}` },
        { status: 500 },
      );
    }
  } else if (isRankedPvP) {
    // Fetch both profiles for current Elo + games (provisional K-factor).
    const { data: profiles, error: profErr } = await admin
      .from("profiles")
      .select("id, elo, games, wins, losses, draws, streak, best_streak")
      .in("id", [body.player1_id, player2Id as string]);

    if (profErr) {
      return NextResponse.json({ error: profErr.message }, { status: 500 });
    }
    const p1 = profiles?.find((p) => p.id === body.player1_id);
    const p2 = profiles?.find((p) => p.id === player2Id);
    if (!p1 || !p2) {
      return NextResponse.json(
        { error: "Both players must have profiles for a ranked match" },
        { status: 400 },
      );
    }

    // Result from p1's perspective.
    const p1Result: EloResult =
      result === "p1" ? "win" : result === "p2" ? "loss" : "draw";
    const p2Result = invertResult(p1Result);

    const p1Delta = computeEloDelta(
      { elo: p1.elo, games: p1.games },
      { elo: p2.elo },
      p1Result,
    );
    const p2Delta = computeEloDelta(
      { elo: p2.elo, games: p2.games },
      { elo: p1.elo },
      p2Result,
    );
    // `elo_delta` stored on the match is from player1's perspective.
    eloDelta = p1Delta;
    matchRow.elo_delta = eloDelta;

    // Apply per-player stat + Elo updates.
    const updates = [
      applyPlayerUpdate(admin, p1, p1Delta, p1Result),
      applyPlayerUpdate(admin, p2, p2Delta, p2Result),
    ];
    const updateResults = await Promise.all(updates);
    const failed = updateResults.find((r) => r.error);
    if (failed?.error) {
      return NextResponse.json(
        { error: `Failed to update profiles: ${failed.error.message}` },
        { status: 500 },
      );
    }
  } else if (body.mode === "solo" || body.mode === "duel") {
    // Record stats for the human player(s); no ranked Elo.
    // For solo, only player1 is human; the human's outcome drives streak/games.
    if (body.mode === "solo") {
      const { data: p1, error } = await admin
        .from("profiles")
        .select("id, games, wins, losses, draws, streak, best_streak")
        .eq("id", body.player1_id)
        .maybeSingle();
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      if (p1) {
        const r: EloResult =
          result === "p1" ? "win" : result === "draw" ? "draw" : "loss";
        const upd = await applyPlayerUpdate(admin, p1, 0, r);
        if (upd.error) {
          return NextResponse.json(
            { error: `Failed to update profile: ${upd.error.message}` },
            { status: 500 },
          );
        }
      }
    }
    // Duel: counts/streak update for both human participants, no Elo.
    if (body.mode === "duel" && player2Id) {
      const { data: profiles, error } = await admin
        .from("profiles")
        .select("id, games, wins, losses, draws, streak, best_streak")
        .in("id", [body.player1_id, player2Id]);
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const p1 = profiles?.find((p) => p.id === body.player1_id);
      const p2 = profiles?.find((p) => p.id === player2Id);
      const p1Result: EloResult =
        result === "p1" ? "win" : result === "p2" ? "loss" : "draw";
      const ops = [];
      if (p1) ops.push(applyPlayerUpdate(admin, p1, 0, p1Result));
      if (p2) ops.push(applyPlayerUpdate(admin, p2, 0, invertResult(p1Result)));
      const settled = await Promise.all(ops);
      const failed = settled.find((s) => s.error);
      if (failed?.error) {
        return NextResponse.json(
          { error: `Failed to update profiles: ${failed.error.message}` },
          { status: 500 },
        );
      }
    }
  }

  // ── Insert (or upsert) the finalized match row ──────────────────────
  const { data: inserted, error: insertErr } = await admin
    .from("matches")
    .upsert(matchRow)
    .select("*")
    .single();

  if (insertErr) {
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ match: inserted }, { status: 200 });
}

type StatProfile = {
  id: string;
  elo?: number;
  games: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  best_streak: number;
};

/**
 * Apply win/loss/draw counters, win-streak, and (optional) Elo delta to a
 * profile. Returns the Supabase update result (so the caller can check error).
 */
function applyPlayerUpdate(
  admin: ReturnType<typeof createAdminClient>,
  profile: StatProfile,
  eloDelta: number,
  result: EloResult,
) {
  const wins = profile.wins + (result === "win" ? 1 : 0);
  const losses = profile.losses + (result === "loss" ? 1 : 0);
  const draws = profile.draws + (result === "draw" ? 1 : 0);
  const games = profile.games + 1;

  // Win-streak: extend on a win, reset on loss/draw. Track best.
  const streak = result === "win" ? profile.streak + 1 : 0;
  const bestStreak = Math.max(profile.best_streak, streak);

  const patch: ProfileUpdate = {
    games,
    wins,
    losses,
    draws,
    streak,
    best_streak: bestStreak,
  };
  if (typeof profile.elo === "number" && eloDelta !== 0) {
    patch.elo = profile.elo + eloDelta;
  }

  return admin.from("profiles").update(patch).eq("id", profile.id);
}
