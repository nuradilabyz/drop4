/**
 * Share helpers for finished Drop4 matches.
 *
 * Turns a `MatchRecord` (the `drop4:match:<id>` shape from lib/game/matchStore)
 * into:
 *   - a public landing URL  `/m/<token>`  (unfurls on social via OG image),
 *   - the OG image URL       `/api/og?...` (1200×630 match card),
 *   - and a one-call `copyShareLink(match)` that writes the landing URL to the
 *     clipboard.
 *
 * The "token" is just the URL-safe base64 (base64url) encoding of the OG query
 * params, so it is self-contained — no DB lookup needed to render the card.
 *
 * Framework-light: no React, no Next imports. The game's "Share" buttons can
 * import `copyShareLink` directly; the `/m/[token]` page imports the decode
 * helpers.
 */

import type { GameResult, Movelist } from "@/engine/types";
import type { MatchRecord } from "@/lib/game/matchStore";

/** Fields that fully describe a shareable match card. */
export interface ShareCard {
  /** Movelist (column indices), serialized into the OG `m` param. */
  movelist: Movelist;
  /** Result from the engine's POV: 'c' coral wins, 'a' aqua wins, 'draw'. */
  result: GameResult;
  /** Player-1 (coral) display name. */
  p1: string;
  /** Player-2 (aqua) display name. */
  p2: string;
  /** Signed Elo delta for the sharer (e.g. "+24", "-18"), or undefined. */
  elo?: string;
  /** Accuracy percentage 0..100, or undefined. */
  acc?: number;
  /** Human label for the mode ("Ranked", "Insane AI", "Duel link"…). */
  mode?: string;
}

// ── base64url (no padding), isomorphic ───────────────────────────────

function toBase64Url(s: string): string {
  let b64: string;
  if (typeof btoa === "function") {
    // Encode UTF-8 → Latin1 bytes before btoa to be safe with names.
    b64 = btoa(unescape(encodeURIComponent(s)));
  } else {
    b64 = Buffer.from(s, "utf-8").toString("base64");
  }
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(s: string): string {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/");
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const padded = b64 + pad;
  if (typeof atob === "function") {
    return decodeURIComponent(escape(atob(padded)));
  }
  return Buffer.from(padded, "base64").toString("utf-8");
}

// ── Result mapping ───────────────────────────────────────────────────

/** Map the engine `GameResult` to the OG `r` param (c | a | draw). */
function resultParam(result: GameResult): "c" | "a" | "draw" {
  return result; // already 'c' | 'a' | 'draw'
}

// ── Building the share card from a stored match ──────────────────────

/**
 * Derive a `ShareCard` from a finished `MatchRecord`. Picks the two player
 * names by chip colour (coral = p1, aqua = p2), and pulls a signed Elo delta if
 * one is attached to the record (optional/forward-compatible field).
 */
export function cardFromMatch(match: MatchRecord): ShareCard {
  const coral = match.players.find((p) => p.chip === "c");
  const aqua = match.players.find((p) => p.chip === "a");

  // Optional extra fields some callers may attach (kept loose on purpose).
  const extra = match as MatchRecord & { eloDelta?: number; accuracy?: number };
  const elo =
    typeof extra.eloDelta === "number" ? formatSigned(extra.eloDelta) : undefined;
  const acc =
    typeof extra.accuracy === "number"
      ? Math.round(extra.accuracy)
      : undefined;

  return {
    movelist: match.movelist,
    result: match.result,
    p1: coral?.name ?? "Coral",
    p2: aqua?.name ?? "Aqua",
    elo,
    acc,
    mode: modeLabel(match),
  };
}

function formatSigned(n: number): string {
  return n > 0 ? `+${n}` : String(n);
}

function modeLabel(match: MatchRecord): string {
  if (match.mode === "ranked") return "Ranked";
  if (match.mode === "duel") return "Duel link";
  if (match.mode === "solo") {
    return match.difficulty
      ? `${cap(match.difficulty)} AI`
      : "Solo";
  }
  return "Drop4";
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// ── URL builders ─────────────────────────────────────────────────────

/** Serialize a `ShareCard` to a URLSearchParams string (the OG query). */
export function shareQuery(card: ShareCard): string {
  const params = new URLSearchParams();
  params.set("m", card.movelist.join("-"));
  params.set("r", resultParam(card.result));
  params.set("p1", card.p1);
  params.set("p2", card.p2);
  if (card.elo) params.set("elo", card.elo);
  if (typeof card.acc === "number") params.set("acc", String(card.acc));
  if (card.mode) params.set("mode", card.mode);
  return params.toString();
}

/** Encode a `ShareCard` into a URL-safe token for `/m/<token>`. */
export function encodeShareToken(card: ShareCard): string {
  return toBase64Url(shareQuery(card));
}

/** Decode a `/m/<token>` token back into a `ShareCard`. Returns null if malformed. */
export function decodeShareToken(token: string): ShareCard | null {
  try {
    const query = fromBase64Url(token);
    return parseShareQuery(query);
  } catch {
    return null;
  }
}

/**
 * Parse an OG/share query string (or `URLSearchParams`) into a `ShareCard`.
 * Robust to missing params — fills sensible defaults so the OG route and the
 * landing page never crash on a hand-edited link.
 */
export function parseShareQuery(
  input: string | URLSearchParams,
): ShareCard {
  const p = typeof input === "string" ? new URLSearchParams(input) : input;

  const movelist = (p.get("m") ?? "")
    .split(/[,\-]/)
    .map((x) => Number.parseInt(x, 10))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);

  const rRaw = p.get("r");
  const result: GameResult =
    rRaw === "a" ? "a" : rRaw === "draw" ? "draw" : "c";

  const accRaw = p.get("acc");
  const accNum = accRaw === null ? NaN : Number.parseInt(accRaw, 10);

  return {
    movelist,
    result,
    p1: p.get("p1") || "Coral",
    p2: p.get("p2") || "Aqua",
    elo: p.get("elo") || undefined,
    acc: Number.isFinite(accNum) ? clamp(accNum, 0, 100) : undefined,
    mode: p.get("mode") || undefined,
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Resolve the site origin (env on the server, `location` in the browser). */
export function siteOrigin(): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  if (typeof window !== "undefined") return window.location.origin;
  return "http://localhost:3000";
}

/** Absolute public landing URL for a card: `<origin>/m/<token>`. */
export function shareUrl(card: ShareCard, origin = siteOrigin()): string {
  return `${origin}/m/${encodeShareToken(card)}`;
}

/** Absolute OG image URL for a card: `<origin>/api/og?<query>`. */
export function ogUrl(card: ShareCard, origin = siteOrigin()): string {
  return `${origin}/api/og?${shareQuery(card)}`;
}

/** Convenience: landing URL straight from a stored match. */
export function shareUrlForMatch(match: MatchRecord, origin?: string): string {
  return shareUrl(cardFromMatch(match), origin);
}

// ── Clipboard ────────────────────────────────────────────────────────

/**
 * Write the public share link for a finished match to the clipboard.
 * Resolves `true` on success. Falls back to a hidden-textarea `execCommand`
 * copy when the async Clipboard API is unavailable (http / older browsers).
 */
export async function copyShareLink(match: MatchRecord): Promise<boolean> {
  const url = shareUrlForMatch(match);
  return copyText(url);
}

/** Lower-level: copy an arbitrary string (used by the share buttons). */
export async function copyText(text: string): Promise<boolean> {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path.
    }
  }
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
