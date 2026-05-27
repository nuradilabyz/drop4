/**
 * localStorage-backed store for Drop4 matches.
 *
 * Two responsibilities:
 *   1. Persist FINISHED games so the AI Coach (built by another agent) can pick
 *      one up by id at `/coach/<id>`. A finished game is stored under
 *      `drop4:match:<id>` and its id is appended to the index `drop4:matches`.
 *   2. Persist IN-PROGRESS solo games so the lobby "Continue" section can resume
 *      them. These live under `drop4:progress:<id>` with their own index
 *      `drop4:progress` and are cleared on finish.
 *
 * Everything is best-effort and SSR-safe: every function no-ops (or returns an
 * empty result) when `window`/`localStorage` is unavailable, so it can be
 * imported anywhere without crashing during render.
 */

import type { Difficulty, GameResult, Movelist, Player } from "@/engine/types";

export type MatchMode = "solo" | "duel" | "ranked";

/** Lightweight identity stored alongside a match (no PII; mock-friendly). */
export interface MatchPlayer {
  /** Disc colour: 'c' = coral (P1), 'a' = aqua (P2). */
  chip: Player;
  name: string;
  rating?: number;
  city?: string;
  /** True for the local human in a solo game. */
  human?: boolean;
}

/** A finished game record — the shape the coach handoff reads. */
export interface MatchRecord {
  id: string;
  mode: MatchMode;
  difficulty?: Difficulty;
  players: MatchPlayer[];
  /** Columns played, alternating, starting with the `starter`. */
  movelist: Movelist;
  /** Who played first ('c' by default). */
  starter: Player;
  /** Per-move think time in ms, parallel to `movelist`. */
  think_ms: number[];
  /** Final outcome. */
  result: GameResult;
  /** ISO timestamp. */
  createdAt: string;
}

/** An in-progress game snapshot for the lobby "Continue" section. */
export interface ProgressRecord {
  id: string;
  mode: MatchMode;
  difficulty?: Difficulty;
  players: MatchPlayer[];
  movelist: Movelist;
  starter: Player;
  /** Whose turn it is right now. */
  toMove: Player;
  /** Move count = movelist.length (denormalised for cheap listing). */
  moves: number;
  updatedAt: string;
}

const MATCH_PREFIX = "drop4:match:";
const MATCH_INDEX = "drop4:matches";
const PROGRESS_PREFIX = "drop4:progress:";
const PROGRESS_INDEX = "drop4:progress";

/** Storage key for a finished match (exported for the coach agent). */
export function matchKey(id: string): string {
  return `${MATCH_PREFIX}${id}`;
}

function store(): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function readJSON<T>(key: string): T | null {
  const s = store();
  if (!s) return null;
  try {
    const raw = s.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJSON(key: string, value: unknown): void {
  const s = store();
  if (!s) return;
  try {
    s.setItem(key, JSON.stringify(value));
  } catch {
    // Quota or serialization error — non-fatal for gameplay.
  }
}

function readIndex(key: string): string[] {
  return readJSON<string[]>(key) ?? [];
}

function addToIndex(key: string, id: string): void {
  const ids = readIndex(key);
  if (!ids.includes(id)) {
    ids.unshift(id);
    writeJSON(key, ids);
  }
}

function removeFromIndex(key: string, id: string): void {
  const ids = readIndex(key).filter((x) => x !== id);
  writeJSON(key, ids);
}

// ── Finished matches ────────────────────────────────────────────────

/** Persist a finished game; returns the record actually stored. */
export function saveMatch(record: MatchRecord): MatchRecord {
  writeJSON(matchKey(record.id), record);
  addToIndex(MATCH_INDEX, record.id);
  return record;
}

/** Read a finished game by id (used by the coach handoff at `/coach/<id>`). */
export function getMatch(id: string): MatchRecord | null {
  return readJSON<MatchRecord>(matchKey(id));
}

/** All finished games, newest first. */
export function listMatches(): MatchRecord[] {
  return readIndex(MATCH_INDEX)
    .map((id) => getMatch(id))
    .filter((m): m is MatchRecord => m !== null);
}

// ── In-progress games ───────────────────────────────────────────────

/** Save / overwrite an in-progress snapshot. */
export function saveProgress(record: ProgressRecord): void {
  writeJSON(`${PROGRESS_PREFIX}${record.id}`, record);
  addToIndex(PROGRESS_INDEX, record.id);
}

/** Remove an in-progress snapshot (call on finish or resign). */
export function clearProgress(id: string): void {
  const s = store();
  if (s) {
    try {
      s.removeItem(`${PROGRESS_PREFIX}${id}`);
    } catch {
      // ignore
    }
  }
  removeFromIndex(PROGRESS_INDEX, id);
}

/** Read one in-progress snapshot by id. */
export function getProgress(id: string): ProgressRecord | null {
  return readJSON<ProgressRecord>(`${PROGRESS_PREFIX}${id}`);
}

/** All in-progress games, newest first (for the lobby "Continue" list). */
export function listProgress(): ProgressRecord[] {
  return readIndex(PROGRESS_INDEX)
    .map((id) => getProgress(id))
    .filter((p): p is ProgressRecord => p !== null)
    .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1));
}
