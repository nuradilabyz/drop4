/**
 * Coach narration provider abstraction.
 *
 * `narrate(input)` turns the *engine's* verdicts (from `analyzeMatch`) into
 * human prose. Two providers:
 *   - **OpenAI** (when `OPENAI_API_KEY` is set): a terse, ruthless Connect-4
 *     coach that EXPLAINS the supplied engine numbers and never invents new
 *     evals or moves. Uses structured JSON output at low temperature.
 *   - **Template** (always available; the fallback when no key): deterministic
 *     prose synthesised from the math so the coach works fully offline.
 *
 * SERVER-ONLY: imports the `openai` SDK and reads server env. Never bundle into
 * a client component — call it from the `/api/coach` route.
 */

import "server-only";
import OpenAI from "openai";
import type {
  AnalyzedMove,
  CoachAnalysis,
  KeyMoment,
  SideStats,
} from "./analyze";
import type { Player } from "@/engine/types";

/** Tone keys map to the design's PatternRow colours. */
export type PatternTone = "success" | "danger" | "coral";

export interface Narration {
  /** One- or two-sentence overall verdict on the game. */
  overall: string;
  /** Per-move one-liners (only a curated subset; keyed by 1-indexed move n). */
  moveAnnotations: { n: number; text: string }[];
  /** "What the coach saw" deep-dive cards for the key moments. */
  whatTheCoachSaw: {
    moveN: number;
    title: string;
    body: string;
    engineLine: number[];
    evalShift: number;
  }[];
  /** "Patterns spotted" callouts. */
  patterns: { tone: PatternTone; title: string; sub: string }[];
}

export interface NarrateInput {
  analysis: CoachAnalysis;
  /** Which colour is "you" (the human / subject of the coaching). Default 'c'. */
  you?: Player;
  /** Display names for the two sides. */
  players?: { c?: { name?: string }; a?: { name?: string } };
  /** 'c' | 'a' | 'draw' — final result if known. */
  result?: Player | "draw";
  mode?: string;
  /** Pro unlocks the full per-move "What the coach saw" depth. */
  isPro?: boolean;
}

/** Max moves we ever describe to the LLM (long games are summarised). */
const MAX_LLM_MOVES = 24;

/** Public entry point. Routes to OpenAI when configured, else template. */
export async function narrate(input: NarrateInput): Promise<Narration> {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  const key = process.env.OPENAI_API_KEY?.trim();

  if (provider === "openai" && key) {
    try {
      return await narrateOpenAI(input, key);
    } catch {
      // Any failure (network, quota, malformed output) → deterministic fallback.
      return templateNarration(input);
    }
  }
  return templateNarration(input);
}

// ── helpers shared by both providers ──────────────────────────────────

function colLabel(col: number): string {
  // 1-indexed column for humans (board has 7 cols, 0-indexed internally).
  return `col ${col + 1}`;
}

function youName(input: NarrateInput): string {
  const you = input.you ?? "c";
  return input.players?.[you]?.name?.trim() || "You";
}

function oppName(input: NarrateInput): string {
  const you = input.you ?? "c";
  const opp: Player = you === "c" ? "a" : "c";
  return input.players?.[opp]?.name?.trim() || "Opponent";
}

/** Eval shift in pawns (1 pawn = 100 cp), signed string. */
function pawns(cp: number): string {
  const v = cp / 100;
  const s = v >= 0 ? "+" : "";
  return `${s}${v.toFixed(1)}`;
}

/** Build a compact, LLM-friendly summary of the analysis. Never includes more
 * than MAX_LLM_MOVES move rows; long games are down-sampled to the key moments
 * plus a stride. */
function summariseForLLM(input: NarrateInput) {
  const { analysis } = input;
  const you = input.you ?? "c";
  const opp: Player = you === "c" ? "a" : "c";

  const keyN = new Set(analysis.keyMoments.map((k) => k.ply));
  let rows: AnalyzedMove[];
  if (analysis.moves.length <= MAX_LLM_MOVES) {
    rows = analysis.moves;
  } else {
    const stride = Math.ceil(analysis.moves.length / MAX_LLM_MOVES);
    rows = analysis.moves.filter(
      (m, i) => keyN.has(m.n) || i % stride === 0 || i === analysis.moves.length - 1,
    );
  }

  const moveRows = rows.map((m) => ({
    n: m.n,
    side: m.player === you ? "you" : "opp",
    col: m.col + 1,
    bestCol: m.bestCol + 1,
    tag: m.tag,
    lossCp: m.lossCp,
    missedThreat: m.missedThreat,
    createdFork: m.createdFork,
    isMate: m.isMate,
  }));

  return {
    result: input.result ?? "unknown",
    mode: input.mode ?? "solo",
    youAre: you === "c" ? "player 1 (coral)" : "player 2 (aqua)",
    stats: {
      you: statSummary(analysis.stats[you]),
      opp: statSummary(analysis.stats[opp]),
    },
    keyMoments: analysis.keyMoments.map((k) => ({
      n: k.ply,
      side: k.player === you ? "you" : "opp",
      kind: k.kind,
      playedCol: k.col + 1,
      bestCol: k.bestCol + 1,
      engineLine: k.engineLine.map((c) => c + 1),
      evalShiftCp: k.evalShift,
    })),
    moves: moveRows,
  };
}

function statSummary(s: SideStats) {
  return {
    accuracy: s.accuracy,
    bestMoves: `${s.bestMoves[0]}/${s.bestMoves[1]}`,
    missedThreats: s.missedThreats,
    avgThinkMs: s.avgThinkMs,
  };
}

// ── OpenAI provider ────────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are a ruthless but precise Connect Four coach. You receive an engine's verdicts about a finished game: per-move centipawn loss, quality tags, missed threats, forks, and key moments with engine lines. Your ONLY job is to EXPLAIN those verdicts in sharp, concrete prose.

Hard rules:
- NEVER invent evaluations, moves, columns, or lines. Use ONLY the numbers and columns provided. Columns are 1-indexed (1..7).
- Be terse and direct. No fluff, no hedging, no "great game!" filler.
- Refer to the coached player as "you" and the opponent by name or "your opponent".
- When you cite a better move, use the engine's bestCol / engineLine exactly as given.
- Centipawn loss: <25 solid, 25-75 inaccuracy, 75-200 a miss, >200 a blunder. A "fork" means two simultaneous winning threats. "missedThreat" means they failed to block an immediate winning threat.
- Output STRICT JSON matching the requested schema. Keep each text field under ~280 characters.`;

function buildUserPrompt(input: NarrateInput): string {
  const summary = summariseForLLM(input);
  const wantCards = input.isPro ? "Provide a whatTheCoachSaw card for EACH key moment." :
    "Provide AT MOST ONE whatTheCoachSaw card (the single most important moment).";
  return [
    `Coached player: ${youName(input)} (${summary.youAre}). Opponent: ${oppName(input)}.`,
    `Result: ${summary.result}. Mode: ${summary.mode}.`,
    ``,
    `Engine data (authoritative — do not contradict):`,
    JSON.stringify(summary),
    ``,
    `Produce JSON with this exact shape:`,
    `{`,
    `  "overall": string,  // 1-2 sentences summarising how you played, grounded in accuracy/best-move/missed-threat numbers`,
    `  "moveAnnotations": [{ "n": number, "text": string }],  // short notes ONLY for tagged moves (fork/miss/blunder/brilliant/inaccuracy)`,
    `  "whatTheCoachSaw": [{ "moveN": number, "title": string, "body": string, "engineLine": number[], "evalShift": number }],`,
    `  "patterns": [{ "tone": "success"|"danger"|"coral", "title": string, "sub": string }]  // 2-3 recurring themes`,
    `}`,
    wantCards,
    `For each whatTheCoachSaw card, copy engineLine and evalShift from the matching key moment. Patterns: tone "success" for strengths, "danger" for weaknesses, "coral" for a signature highlight.`,
  ].join("\n");
}

async function narrateOpenAI(input: NarrateInput, apiKey: string): Promise<Narration> {
  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_COACH_MODEL || "gpt-4o-mini";

  const completion = await client.chat.completions.create({
    model,
    temperature: 0.2,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserPrompt(input) },
    ],
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error("Empty completion");
  const parsed = JSON.parse(raw) as unknown;
  return coerceNarration(parsed, input);
}

/** Defensively coerce the model's JSON into a valid Narration, falling back to
 * template-derived values for any missing/invalid fields. */
function coerceNarration(raw: unknown, input: NarrateInput): Narration {
  const fallback = templateNarration(input);
  if (typeof raw !== "object" || raw === null) return fallback;
  const r = raw as Record<string, unknown>;

  const overall = typeof r.overall === "string" && r.overall.trim()
    ? r.overall.trim()
    : fallback.overall;

  const moveAnnotations = Array.isArray(r.moveAnnotations)
    ? r.moveAnnotations
        .filter((m): m is { n: number; text: string } =>
          typeof m === "object" && m !== null &&
          typeof (m as { n?: unknown }).n === "number" &&
          typeof (m as { text?: unknown }).text === "string")
        .map((m) => ({ n: m.n, text: m.text.trim() }))
    : fallback.moveAnnotations;

  const whatTheCoachSaw = Array.isArray(r.whatTheCoachSaw)
    ? r.whatTheCoachSaw
        .filter((c): c is Record<string, unknown> => typeof c === "object" && c !== null)
        .map((c) => ({
          moveN: Number((c as { moveN?: unknown }).moveN) || 0,
          title: String((c as { title?: unknown }).title ?? "").trim() || "Key moment",
          body: String((c as { body?: unknown }).body ?? "").trim(),
          engineLine: Array.isArray((c as { engineLine?: unknown }).engineLine)
            ? ((c as { engineLine: unknown[] }).engineLine.map((x) => Number(x)).filter((x) => Number.isFinite(x)))
            : [],
          evalShift: Number((c as { evalShift?: unknown }).evalShift) || 0,
        }))
        .filter((c) => c.body.length > 0)
    : fallback.whatTheCoachSaw;

  const patterns = Array.isArray(r.patterns)
    ? r.patterns
        .filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
        .map((p) => ({
          tone: normaliseTone((p as { tone?: unknown }).tone),
          title: String((p as { title?: unknown }).title ?? "").trim() || "Pattern",
          sub: String((p as { sub?: unknown }).sub ?? "").trim(),
        }))
        .filter((p) => p.sub.length > 0)
    : fallback.patterns;

  return {
    overall,
    moveAnnotations: moveAnnotations.length ? moveAnnotations : fallback.moveAnnotations,
    whatTheCoachSaw: whatTheCoachSaw.length ? whatTheCoachSaw : fallback.whatTheCoachSaw,
    patterns: patterns.length ? patterns : fallback.patterns,
  };
}

function normaliseTone(t: unknown): PatternTone {
  if (t === "success" || t === "danger" || t === "coral") return t;
  return "coral";
}

// ── Template (deterministic) provider ──────────────────────────────────

/**
 * Synthesise a sensible Narration purely from the math. Used when no OpenAI key
 * is configured, or as the failure fallback. Deterministic for a given input.
 */
export function templateNarration(input: NarrateInput): Narration {
  const { analysis } = input;
  const you = input.you ?? "c";
  const opp: Player = you === "c" ? "a" : "c";
  const me = youName(input);
  const them = oppName(input);
  const myStats = analysis.stats[you];
  const oppStats = analysis.stats[opp];

  const overall = buildOverall(input, me, myStats);

  // Move annotations: every tagged move belonging to either side.
  const moveAnnotations = analysis.moves
    .filter((m) => m.tag !== "normal" && m.tag !== "good")
    .map((m) => ({
      n: m.n,
      text: annotateMove(m, m.player === you ? "you" : them),
    }));

  // What the coach saw: cards from the key moments (Pro = all, free = top 1).
  const moments = input.isPro ? analysis.keyMoments : analysis.keyMoments.slice(0, 1);
  const whatTheCoachSaw = moments.map((k) => cardForMoment(k, you, them));

  const patterns = buildPatterns(analysis, you, me, them, myStats, oppStats);

  return { overall, moveAnnotations, whatTheCoachSaw, patterns };
}

function buildOverall(input: NarrateInput, me: string, myStats: SideStats): string {
  const acc = myStats.accuracy;
  const [made, total] = myStats.bestMoves;
  const missed = myStats.missedThreats;
  const result = input.result;
  const you = input.you ?? "c";

  const outcome =
    result === undefined ? "" :
    result === "draw" ? "The game ended in a draw. " :
    result === you ? "You took the win. " : "You lost this one. ";

  const grade =
    acc >= 90 ? "near-flawless" :
    acc >= 80 ? "strong" :
    acc >= 65 ? "solid but uneven" :
    acc >= 50 ? "shaky" : "loose";

  const missClause = missed > 0
    ? ` ${missed} time${missed === 1 ? "" : "s"} you let an immediate winning threat go unblocked — fix that first.`
    : " You never let an immediate winning threat slip — clean defensively.";

  return `${outcome}${me === "You" ? "You" : me} played ${grade} at ${acc}% accuracy, finding the engine's top move ${made} of ${total} times.${missClause}`;
}

function annotateMove(m: AnalyzedMove, who: string): string {
  const played = colLabel(m.col);
  const best = colLabel(m.bestCol);
  const subj = who === "you" ? "You" : who;
  switch (m.tag) {
    case "brilliant":
      return m.createdFork
        ? `${subj} found ${played} — a brilliant fork the engine also rates best.`
        : `${subj} found ${played} — the only move that holds, and the engine's pick.`;
    case "fork":
      return `${subj} played ${played}, opening two simultaneous winning threats.`;
    case "miss":
      return m.missedThreat
        ? `${subj} played ${played} but left an immediate threat unblocked; ${best} was forced (${pawns(m.lossCp)} lost).`
        : `${subj} played ${played}; ${best} was clearly stronger (${pawns(m.lossCp)} lost).`;
    case "blunder":
      return m.missedThreat
        ? `${subj} played ${played} and missed the winning block — ${best} was forced. ${pawns(m.lossCp)} swing.`
        : `${subj} blundered with ${played}; the engine wanted ${best} (${pawns(m.lossCp)} swing).`;
    case "inaccuracy":
      return `${subj} played ${played}; a touch loose — ${best} kept more (${pawns(m.lossCp)}).`;
    default:
      return `${subj} played ${played}.`;
  }
}

function cardForMoment(
  k: KeyMoment,
  you: Player,
  them: string,
): Narration["whatTheCoachSaw"][number] {
  const mine = k.player === you;
  const subj = mine ? "You" : them;
  const played = colLabel(k.col);
  const best = colLabel(k.bestCol);
  const line = k.engineLine;

  let title: string;
  let body: string;
  switch (k.kind) {
    case "brilliant":
      title = `Brilliant · move ${k.ply}`;
      body = `${subj} found ${played} — the engine's top move and the only line that keeps the advantage. Hard to spot, exactly right.`;
      break;
    case "fork":
      title = `Double threat · move ${k.ply}`;
      body = `${subj} played ${played} and created two winning threats at once. The reply can only stop one.`;
      break;
    case "blunder":
      title = `Critical mistake · move ${k.ply}`;
      body = mine
        ? `You played ${played}, but the engine prefers ${best}. That cost about ${pawns(k.evalShift)} and handed back the initiative.`
        : `${them} played ${played}; ${best} was far stronger. The position swung ${pawns(k.evalShift)}.`;
      break;
    default:
      title = `Turning point · move ${k.ply}`;
      body = mine
        ? `You played ${played} but missed ${best}. About ${pawns(k.evalShift)} slipped away here.`
        : `${them} played ${played} over the stronger ${best}; ${pawns(k.evalShift)} swing.`;
  }

  return { moveN: k.ply, title, body, engineLine: line, evalShift: k.evalShift };
}

function buildPatterns(
  analysis: CoachAnalysis,
  you: Player,
  me: string,
  them: string,
  myStats: SideStats,
  oppStats: SideStats,
): Narration["patterns"] {
  const out: Narration["patterns"] = [];
  void them;
  void oppStats;

  const myMoves = analysis.moves.filter((m) => m.player === you);
  const forks = myMoves.filter((m) => m.createdFork);
  const misses = myMoves.filter((m) => m.tag === "miss" || m.tag === "blunder");
  const brilliancies = myMoves.filter((m) => m.tag === "brilliant");

  if (brilliancies.length) {
    const m = brilliancies[0];
    out.push({
      tone: "coral",
      title: `Brilliant resource at move ${m.n}`,
      sub: `Found ${colLabel(m.col)} when it mattered most.`,
    });
  }

  if (forks.length) {
    const m = forks[0];
    out.push({
      tone: "success",
      title: `Double threat at move ${m.n}`,
      sub: `Forced the reply with two winning lines at once.`,
    });
  }

  if (myStats.missedThreats > 0) {
    out.push({
      tone: "danger",
      title: `Unblocked threats ×${myStats.missedThreats}`,
      sub: `You let an immediate winning threat go unanswered — scan the opponent's reply first.`,
    });
  } else if (misses.length) {
    const m = misses[0];
    out.push({
      tone: "danger",
      title: `Biggest swing at move ${m.n}`,
      sub: `${colLabel(m.bestCol)} was stronger than ${colLabel(m.col)} (${pawns(m.lossCp)}).`,
    });
  }

  if (myStats.accuracy >= 85) {
    out.push({
      tone: "success",
      title: `${myStats.accuracy}% accuracy`,
      sub: `${me === "You" ? "You" : me} stayed close to the engine all game.`,
    });
  }

  // Always return at least one pattern.
  if (out.length === 0) {
    out.push({
      tone: "coral",
      title: `Steady play`,
      sub: `No major swings — a controlled, even game.`,
    });
  }

  return out.slice(0, 4);
}
