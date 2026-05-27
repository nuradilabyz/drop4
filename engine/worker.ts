/**
 * Web Worker entry — off-main-thread wrapper around the PURE engine functions.
 *
 * This file is the ONLY worker-context file in the engine besides index.ts.
 * It contains no game logic of its own: it just receives messages, calls the
 * pure functions (chooseMove / bestMove / detectThreats / analyzeGame), and
 * posts results back. Because all heavy logic lives in the pure modules, the
 * exact same code paths run server-side (Node) without this file.
 *
 * ── Worker protocol ────────────────────────────────────────────────
 * Requests (main → worker):
 *   { type: 'move',     id, cells, difficulty }   → run the AI opponent move
 *   { type: 'bestmove', id, cells }               → true best move (PRO hint)
 *   { type: 'threats',  id, cells, forPlayer? }   → threat squares
 *   { type: 'analyze',  id, moves }               → per-move game analysis
 *   { type: 'cancel',   id }                       → mark id cancelled
 *
 * Responses (worker → main):
 *   { type: 'result',   id, result: SearchResult }
 *   { type: 'threats',  id, threats: Coord[] }
 *   { type: 'analysis', id, perMove: MoveEval[] }
 *   { type: 'progress', id, depth }                (reserved for ID search)
 *   { type: 'error',    id, message }
 *
 * Cancellation is cooperative: synchronous searches can't be interrupted
 * mid-call in JS, so 'cancel' marks the id so its result is suppressed when it
 * finishes (and any not-yet-started work is skipped).
 */

import type { Cells, Difficulty, Player, Movelist, Coord, SearchResult } from "./types";
import { chooseMove, bestMove } from "./search";
import { detectThreats } from "./threats";
import { analyzeGame, type MoveEval } from "./analyze";

export type WorkerRequest =
  | { type: "move"; id: number; cells: Cells; difficulty: Difficulty }
  | { type: "bestmove"; id: number; cells: Cells }
  | { type: "threats"; id: number; cells: Cells; forPlayer?: Player }
  | { type: "analyze"; id: number; moves: Movelist }
  | { type: "cancel"; id: number };

export type WorkerResponse =
  | { type: "result"; id: number; result: SearchResult }
  | { type: "threats"; id: number; threats: Coord[] }
  | { type: "analysis"; id: number; perMove: MoveEval[] }
  | { type: "progress"; id: number; depth: number }
  | { type: "error"; id: number; message: string };

const cancelled = new Set<number>();

// `self` is the worker global scope. Typed loosely to avoid pulling in DOM lib
// assumptions; the host bundler (Turbopack) provides the worker runtime.
const ctx = self as unknown as {
  onmessage: ((e: MessageEvent<WorkerRequest>) => void) | null;
  postMessage: (msg: WorkerResponse) => void;
};

function reply(msg: WorkerResponse): void {
  if (cancelled.has(msg.id)) {
    cancelled.delete(msg.id);
    return;
  }
  ctx.postMessage(msg);
}

ctx.onmessage = (e: MessageEvent<WorkerRequest>) => {
  const req = e.data;
  try {
    switch (req.type) {
      case "cancel": {
        cancelled.add(req.id);
        return;
      }
      case "move": {
        if (cancelled.has(req.id)) return void cancelled.delete(req.id);
        const result = chooseMove(req.cells, req.difficulty);
        reply({ type: "result", id: req.id, result });
        return;
      }
      case "bestmove": {
        if (cancelled.has(req.id)) return void cancelled.delete(req.id);
        const result = bestMove(req.cells);
        reply({ type: "result", id: req.id, result });
        return;
      }
      case "threats": {
        if (cancelled.has(req.id)) return void cancelled.delete(req.id);
        const threats = detectThreats(req.cells, req.forPlayer);
        reply({ type: "threats", id: req.id, threats });
        return;
      }
      case "analyze": {
        if (cancelled.has(req.id)) return void cancelled.delete(req.id);
        const perMove = analyzeGame(req.moves);
        reply({ type: "analysis", id: req.id, perMove });
        return;
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ type: "error", id: req.id, message });
  }
};
