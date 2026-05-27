/**
 * AI Coach analysis endpoint.
 *
 * POST { matchId?, movelist, players?, result?, mode?, isPro? }
 *   → { analysis: CoachAnalysis, narration: Narration, cached: boolean }
 *
 * Pipeline:
 *   1. Compute the pure `analyzeMatch(movelist)` (engine math + tags).
 *   2. If the caller is authenticated AND `matchId` is a real DB match they can
 *      read, check the `coach_analyses` cache (keyed by match_id + version).
 *      On a hit, return the cached payload. On a miss, narrate then persist via
 *      the admin (service-role) client.
 *   3. Otherwise (guest / solo / no DB) skip the cache entirely: compute +
 *      narrate + return. The endpoint MUST work with no auth and no DB.
 *
 * Narration degrades gracefully: with no `OPENAI_API_KEY` it uses the
 * deterministic template provider, so this route NEVER 500s on a missing key.
 *
 * runtime = nodejs (engine + openai SDK + service-role client are server-only).
 */

import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { COLS } from "@/engine/types";
import {
  analyzeMatch,
  COACH_ANALYSIS_VERSION,
  type CoachAnalysis,
} from "@/lib/coach/analyze";
import { narrate, type Narration } from "@/lib/coach/llm";
import type { Player } from "@/engine/types";
import type { Json } from "@/types/database";

export const runtime = "nodejs";

const PlayerMetaSchema = z
  .object({
    name: z.string().optional(),
    rating: z.number().optional(),
    city: z.string().optional(),
  })
  .optional();

const BodySchema = z.object({
  matchId: z.string().optional(),
  movelist: z.array(z.number().int().min(0).max(COLS - 1)).min(1).max(COLS * 6),
  players: z
    .object({ c: PlayerMetaSchema, a: PlayerMetaSchema })
    .optional(),
  thinkMs: z.array(z.number().int().nonnegative()).optional(),
  result: z.enum(["c", "a", "draw"]).optional(),
  mode: z.string().optional(),
  /** Which colour is the coached "you". Defaults to 'c' (solo human is P1). */
  you: z.enum(["c", "a"]).optional(),
  isPro: z.boolean().optional(),
});

/** Cached payload shape persisted in coach_analyses.analysis (jsonb). */
interface CachedPayload {
  analysis: CoachAnalysis;
  narration: Narration;
}

/** UUID v4-ish check — only real DB matches (UUID PKs) are cacheable. */
function isUuid(s: string | undefined): s is string {
  return !!s && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

export async function POST(request: NextRequest) {
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
  const you: Player = body.you ?? "c";
  const isPro = body.isPro ?? false;

  // ── 1. Pure engine analysis (always runs) ────────────────────────────
  let analysis: CoachAnalysis;
  try {
    analysis = analyzeMatch(body.movelist, { thinkMs: body.thinkMs });
  } catch {
    return NextResponse.json(
      { error: "Movelist is not a legal game" },
      { status: 400 },
    );
  }

  // ── 2. Cache path: only for authenticated owners of a real DB match ──
  const cacheable = isUuid(body.matchId);
  if (cacheable) {
    const cached = await tryReadCache(body.matchId!, isPro);
    if (cached) {
      return NextResponse.json(
        { analysis: cached.analysis, narration: cached.narration, cached: true },
        { status: 200 },
      );
    }
  }

  // ── 3. Narrate (OpenAI if keyed, else deterministic template) ────────
  const narration = await narrate({
    analysis,
    you,
    players: body.players,
    result: body.result,
    mode: body.mode,
    isPro,
  });

  // Persist to cache (best-effort) for real DB matches. Never block the
  // response on a cache write failure.
  if (cacheable) {
    void writeCache(body.matchId!, { analysis, narration }, isPro);
  }

  return NextResponse.json(
    { analysis, narration, cached: false },
    { status: 200 },
  );
}

/**
 * Read a cached analysis if the caller is authenticated and may read the match.
 * Returns null on any miss / lack of auth / lack of DB config (so we fall back
 * to live compute). Free vs Pro share the same cache row, but a free request
 * must not be served Pro narration depth, so we down-scope on read.
 */
async function tryReadCache(
  matchId: string,
  isPro: boolean,
): Promise<CachedPayload | null> {
  // Auth check via the cookie-scoped server client. If Supabase env is missing
  // or the user is not authed, treat as a guest (no cache).
  let userId: string | null = null;
  try {
    const { createClient } = await import("@/lib/supabase/server");
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    userId = data.user?.id ?? null;
  } catch {
    return null;
  }
  if (!userId) return null;

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    // Confirm the match exists and the caller is a participant (RLS-bypassing
    // admin client → we authorize manually).
    const { data: match } = await admin
      .from("matches")
      .select("id, player1_id, player2_id")
      .eq("id", matchId)
      .maybeSingle();
    if (!match) return null;
    if (match.player1_id !== userId && match.player2_id !== userId) return null;

    const { data: row } = await admin
      .from("coach_analyses")
      .select("analysis, version")
      .eq("match_id", matchId)
      .eq("version", COACH_ANALYSIS_VERSION)
      .maybeSingle();

    if (!row?.analysis) return null;
    const payload = row.analysis as unknown as CachedPayload;
    if (!payload.analysis || !payload.narration) return null;

    // Free requests must not receive the full Pro card set.
    if (!isPro && payload.narration.whatTheCoachSaw.length > 1) {
      payload.narration = {
        ...payload.narration,
        whatTheCoachSaw: payload.narration.whatTheCoachSaw.slice(0, 1),
      };
    }
    return payload;
  } catch {
    return null;
  }
}

/** Best-effort cache write (admin client). Silently ignores all failures. */
async function writeCache(
  matchId: string,
  payload: CachedPayload,
  isPro: boolean,
): Promise<void> {
  // Only persist the full (Pro) narration so the cache is the richest version;
  // free reads down-scope. If this is a free request, still cache the math but
  // skip overwriting a richer existing row.
  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();

    if (!isPro) {
      const { data: existing } = await admin
        .from("coach_analyses")
        .select("match_id")
        .eq("match_id", matchId)
        .eq("version", COACH_ANALYSIS_VERSION)
        .maybeSingle();
      if (existing) return; // don't clobber a possibly-richer row
    }

    await admin.from("coach_analyses").upsert({
      match_id: matchId,
      version: COACH_ANALYSIS_VERSION,
      analysis: payload as unknown as Json,
    });
  } catch {
    // ignore — caching is an optimization, not a requirement
  }
}
