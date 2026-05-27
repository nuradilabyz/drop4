/**
 * Typed read/write helpers over the Supabase clients.
 *
 * Each helper takes a `SupabaseClient<Database>` so it works with either the
 * browser, server, or admin client. Reads respect RLS for the passed client;
 * pass the admin client only from trusted server code.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  Database,
  DailyPuzzle,
  DuelRoom,
  LeaderboardRow,
  Match,
  MatchInsert,
  Profile,
  ProfileInsert,
  ProfileUpdate,
} from "@/types/database";

export type DB = SupabaseClient<Database>;

export type LeaderboardPeriod = "alltime" | "weekly" | "monthly";

// ── Profiles ─────────────────────────────────────────────────────────

/** Fetch a single profile by id (uuid). Returns null if not found. */
export async function getProfile(db: DB, id: string): Promise<Profile | null> {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Fetch a profile by its unique username. Returns null if not found. */
export async function getProfileByUsername(
  db: DB,
  username: string,
): Promise<Profile | null> {
  const { data, error } = await db
    .from("profiles")
    .select("*")
    .eq("username", username)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Insert or update a profile (self only under RLS unless using admin client). */
export async function upsertProfile(
  db: DB,
  profile: ProfileInsert,
): Promise<Profile> {
  const { data, error } = await db
    .from("profiles")
    .upsert(profile)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

/** Patch fields on a profile by id. */
export async function updateProfile(
  db: DB,
  id: string,
  patch: ProfileUpdate,
): Promise<Profile> {
  const { data, error } = await db
    .from("profiles")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ── Leaderboard ──────────────────────────────────────────────────────

/**
 * Aggregate leaderboard via the SECURITY DEFINER `leaderboard()` function.
 * Optional city filter; period controls ranking + weekly_delta semantics.
 */
export async function getLeaderboard(
  db: DB,
  opts: { city?: string | null; period?: LeaderboardPeriod } = {},
): Promise<LeaderboardRow[]> {
  const { city = null, period = "alltime" } = opts;
  const { data, error } = await db.rpc("leaderboard", {
    p_city: city,
    p_period: period,
  });
  if (error) throw error;
  return (data ?? []) as LeaderboardRow[];
}

// ── Matches ──────────────────────────────────────────────────────────

/** Fetch a single match by id. Returns null if not visible / not found. */
export async function getMatch(db: DB, id: string): Promise<Match | null> {
  const { data, error } = await db
    .from("matches")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/**
 * Recent matches for a user (either seat), newest first.
 * RLS limits visibility to the caller's own matches + finished ranked games.
 */
export async function getRecentMatches(
  db: DB,
  userId: string,
  limit = 20,
): Promise<Match[]> {
  const { data, error } = await db
    .from("matches")
    .select("*")
    .or(`player1_id.eq.${userId},player2_id.eq.${userId}`)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

/** Create a match row (e.g. when a game starts). Returns the inserted row. */
export async function createMatch(
  db: DB,
  match: MatchInsert,
): Promise<Match> {
  const { data, error } = await db
    .from("matches")
    .insert(match)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

// ── Daily puzzle ─────────────────────────────────────────────────────

/** Fetch the puzzle for a given ISO date (defaults to today). */
export async function getDailyPuzzle(
  db: DB,
  date?: string,
): Promise<DailyPuzzle | null> {
  const day = date ?? new Date().toISOString().slice(0, 10);
  const { data, error } = await db
    .from("daily_puzzles")
    .select("*")
    .eq("date", day)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ── Duel rooms ───────────────────────────────────────────────────────

/** Fetch a duel room by slug (link recipients can read). */
export async function getDuelRoom(
  db: DB,
  slug: string,
): Promise<DuelRoom | null> {
  const { data, error } = await db
    .from("duel_rooms")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data;
}
