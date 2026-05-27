/**
 * Drop4 engine — public entry point.
 *
 * `createEngine()` returns a Promise-based client that offloads searches to a
 * Web Worker on the main thread, falling back to synchronous in-thread
 * execution of the pure functions when no Worker is available (SSR, tests,
 * older runtimes). The pure functions are ALSO re-exported so server code (the
 * AI Coach route, match finalize) can import and call them directly without a
 * worker.
 *
 * This is the ONLY browser-coupled file in the engine: it lazily creates the
 * Worker, guarded by `typeof Worker !== 'undefined'`.
 *
 * ── Public API (frozen — other agents depend on these exact shapes) ──
 *   interface Engine {
 *     getMove(cells, difficulty): Promise<SearchResult>;   // AI opponent move
 *     getBestMove(cells): Promise<SearchResult>;           // PRO hint
 *     getThreats(cells, forPlayer?): Promise<Coord[]>;
 *     analyze(moves): Promise<MoveEval[]>;                 // post-game per-move
 *     cancel(): void;                                      // abort in-flight
 *     terminate(): void;
 *   }
 */

import type {
  Cells,
  Coord,
  Difficulty,
  Movelist,
  Player,
  SearchResult,
} from "./types";
import type { WorkerRequest, WorkerResponse } from "./worker";

import { chooseMove, bestMove } from "./search";
import { detectThreats } from "./threats";
import { analyzeGame, type MoveEval } from "./analyze";

export type { MoveEval } from "./analyze";

/** Distributive Omit so unions keep their per-variant fields. */
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

/** A worker request without its `id` (assigned at post time). Excludes the
 * `cancel` control message, which is sent separately. */
type RequestPayload = DistributiveOmit<
  Exclude<WorkerRequest, { type: "cancel" }>,
  "id"
>;

// Re-export pure functions for direct server/in-thread use.
export { chooseMove, bestMove } from "./search";
export { detectThreats, allThreatSquares, hasImmediateWin } from "./threats";
export { analyzeGame } from "./analyze";
export { evaluate, evalBar } from "./eval";
export { solve } from "./solver";

export interface Engine {
  /** AI opponent move at the given difficulty. */
  getMove(cells: Cells, difficulty: Difficulty): Promise<SearchResult>;
  /** True best move (PRO hint). */
  getBestMove(cells: Cells): Promise<SearchResult>;
  /** Squares that complete a four for `forPlayer` (defaults to side to move). */
  getThreats(cells: Cells, forPlayer?: Player): Promise<Coord[]>;
  /** Post-game per-move analysis (consumed by the AI Coach). */
  analyze(moves: Movelist): Promise<MoveEval[]>;
  /** Abort the in-flight search (best-effort; cooperative in the worker). */
  cancel(): void;
  /** Tear down the worker. */
  terminate(): void;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (reason?: unknown) => void;
  kind: "result" | "threats" | "analysis";
}

/**
 * Worker-backed engine. Falls back to running the pure functions on the
 * current thread when `Worker` is unavailable.
 */
class EngineClient implements Engine {
  private worker: Worker | null = null;
  private nextId = 1;
  private pending = new Map<number, Pending>();
  private inFlight: number[] = [];
  private readonly canUseWorker = typeof Worker !== "undefined";

  private getWorker(): Worker | null {
    if (!this.canUseWorker) return null;
    if (this.worker) return this.worker;
    try {
      this.worker = new Worker(new URL("./worker.ts", import.meta.url), {
        type: "module",
      });
      this.worker.onmessage = (e: MessageEvent<WorkerResponse>) =>
        this.onMessage(e.data);
      this.worker.onerror = (e: ErrorEvent) => this.onWorkerError(e);
      return this.worker;
    } catch {
      // Bundler/runtime can't create the worker — degrade to in-thread.
      this.worker = null;
      return null;
    }
  }

  private onMessage(msg: WorkerResponse): void {
    const p = this.pending.get(msg.id);
    if (!p) return;
    if (msg.type === "progress") return; // informational only
    this.pending.delete(msg.id);
    this.inFlight = this.inFlight.filter((x) => x !== msg.id);
    switch (msg.type) {
      case "result":
        p.resolve(msg.result);
        break;
      case "threats":
        p.resolve(msg.threats);
        break;
      case "analysis":
        p.resolve(msg.perMove);
        break;
      case "error":
        p.reject(new Error(msg.message));
        break;
    }
  }

  private onWorkerError(e: ErrorEvent): void {
    // Reject everything outstanding; future calls fall back to in-thread.
    const err = new Error(e.message || "engine worker error");
    for (const [, p] of this.pending) p.reject(err);
    this.pending.clear();
    this.inFlight = [];
    this.worker = null;
  }

  private post<T>(req: RequestPayload, kind: Pending["kind"]): Promise<T> {
    const worker = this.getWorker();
    const id = this.nextId++;
    if (!worker) {
      // In-thread fallback: run the pure function synchronously.
      return this.runInThread<T>(req, kind);
    }
    this.inFlight.push(id);
    return new Promise<T>((resolve, reject) => {
      this.pending.set(id, {
        resolve: resolve as (v: unknown) => void,
        reject,
        kind,
      });
      worker.postMessage({ ...req, id } as WorkerRequest);
    });
  }

  private runInThread<T>(req: RequestPayload, _kind: Pending["kind"]): Promise<T> {
    try {
      switch (req.type) {
        case "move":
          return Promise.resolve(chooseMove(req.cells, req.difficulty) as unknown as T);
        case "bestmove":
          return Promise.resolve(bestMove(req.cells) as unknown as T);
        case "threats":
          return Promise.resolve(detectThreats(req.cells, req.forPlayer) as unknown as T);
        case "analyze":
          return Promise.resolve(analyzeGame(req.moves) as unknown as T);
      }
      // Exhaustive: RequestPayload has no other variants.
      const _exhaustive: never = req;
      return Promise.reject(new Error(`unsupported request: ${JSON.stringify(_exhaustive)}`));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  getMove(cells: Cells, difficulty: Difficulty): Promise<SearchResult> {
    return this.post<SearchResult>({ type: "move", cells, difficulty }, "result");
  }

  getBestMove(cells: Cells): Promise<SearchResult> {
    return this.post<SearchResult>({ type: "bestmove", cells }, "result");
  }

  getThreats(cells: Cells, forPlayer?: Player): Promise<Coord[]> {
    return this.post<Coord[]>({ type: "threats", cells, forPlayer }, "threats");
  }

  analyze(moves: Movelist): Promise<MoveEval[]> {
    return this.post<MoveEval[]>({ type: "analyze", moves }, "analysis");
  }

  cancel(): void {
    const worker = this.worker;
    if (!worker) return;
    for (const id of this.inFlight) {
      worker.postMessage({ type: "cancel", id } as WorkerRequest);
      const p = this.pending.get(id);
      if (p) {
        this.pending.delete(id);
        p.reject(new Error("cancelled"));
      }
    }
    this.inFlight = [];
  }

  terminate(): void {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    for (const [, p] of this.pending) p.reject(new Error("engine terminated"));
    this.pending.clear();
    this.inFlight = [];
  }
}

/** Create a Promise-based engine client (worker-backed in the browser). */
export function createEngine(): Engine {
  return new EngineClient();
}
