"use client";

/**
 * Solo (vs-AI) game controller.
 *
 * Owns the full client-side game lifecycle: board state, move list + think
 * times, turn/total clocks, the engine worker, hints, threat overlay, the
 * best-of-N series, and localStorage persistence (in-progress + finished).
 *
 * The human is always coral ('c'); the AI is aqua ('a'). The `starter` flips on
 * each rematch so both sides get the first move across a session.
 *
 * Engine calls are funneled through a single `createEngine()` instance created
 * on mount and torn down (`terminate()`) on unmount. Input is blocked while the
 * AI is thinking (`status === 'thinking'`) — the consumer disables the Board.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createEngine, type Engine } from "@/engine";
import {
  canDrop,
  columnHeight,
  createBoard,
  drop,
  isFull,
  legalColumns,
  playerToMove,
  winningLineAt,
  type Cells,
  type Coord,
  type Difficulty,
  type GameResult,
  type Movelist,
  type Player,
} from "@/engine/types";
import {
  clearProgress,
  saveMatch,
  saveProgress,
  type MatchPlayer,
} from "./matchStore";

export type SoloStatus = "playing" | "thinking" | "won" | "draw";

const HUMAN: Player = "c";
const AI: Player = "a";

export interface UseSoloGameOptions {
  /** Stable game id (from the route). Used for persistence + coach handoff. */
  id: string;
  difficulty: Difficulty;
  /** Best-of-N series length. 1 = single game (default). Use 5 for Bo5. */
  bestOf?: number;
  /** PRO unlocks unlimited hints / threats. */
  isPro?: boolean;
  /** Free-tier hint budget. */
  freeHints?: number;
  /** Free-tier threat-reveal budget. */
  freeThreats?: number;
  /** Display name for the human. */
  humanName?: string;
  /** Display name for the AI (defaults to "<Difficulty> AI"). */
  aiName?: string;
}

export interface SoloGameState {
  cells: Cells;
  movelist: Movelist;
  thinkMs: number[];
  status: SoloStatus;
  /** Side to move while playing; frozen at game end. */
  current: Player;
  winLine: Coord[] | null;
  result: GameResult | null;
  /** Winner of the just-finished game, or null on draw/in-progress. */
  winner: Player | null;
  /** Threat squares to render on the board (empty when the toggle is off). */
  threats: Coord[];
  threatsOn: boolean;
  /** Transient engine-hint column to highlight, or null. */
  hintCol: number | null;
  /** Total elapsed ms across the current game. */
  elapsedMs: number;
  /** Live clock (ms) for the active player's current turn. */
  turnMs: number;
  /** Series score keyed by player. */
  series: { c: number; a: number };
  bestOf: number;
  /** Whole series finished (someone reached the win threshold). */
  seriesOver: boolean;
  /** Hints remaining (Infinity for PRO). */
  hintsLeft: number;
  /** Threat reveals remaining (Infinity for PRO). */
  threatsLeft: number;
  /** Who started this game ('c' first by default, flips on rematch). */
  starter: Player;
  difficulty: Difficulty;
  players: { human: MatchPlayer; ai: MatchPlayer };
}

export interface SoloGameApi extends SoloGameState {
  /** Human plays a column. No-ops unless it's the human's turn and legal. */
  play: (col: number) => void;
  /** Request the engine's best move (PRO / limited free). Returns the column. */
  requestHint: () => Promise<number | null>;
  /** Toggle the opponent-threat overlay (consumes a free-tier reveal to turn on). */
  toggleThreats: () => Promise<void>;
  /** Reset the board for the next game; flips the starter. */
  rematch: () => void;
  /** Resign the current game (counts as a loss for the human). */
  resign: () => void;
  /** Whether the hint button is locked (free budget exhausted, not PRO). */
  hintLocked: boolean;
  /** Whether the threats button is locked. */
  threatsLocked: boolean;
  /** Persist the finished game and return its id for the coach handoff. */
  saveForCoach: () => string;
}

function aiDisplayName(d: Difficulty): string {
  return `${d.charAt(0).toUpperCase()}${d.slice(1)} AI`;
}

/** Build the human + AI MatchPlayer identities once. */
function makePlayers(humanName: string, aiName: string): {
  human: MatchPlayer;
  ai: MatchPlayer;
} {
  return {
    human: { chip: HUMAN, name: humanName, human: true },
    ai: { chip: AI, name: aiName },
  };
}

export function useSoloGame(opts: UseSoloGameOptions): SoloGameApi {
  const {
    id,
    difficulty,
    bestOf = 1,
    isPro = false,
    freeHints = 3,
    freeThreats = 3,
    humanName = "You",
    aiName = aiDisplayName(difficulty),
  } = opts;

  const engineRef = useRef<Engine | null>(null);
  if (engineRef.current === null) {
    engineRef.current = createEngine();
  }

  const players = useMemo(
    () => makePlayers(humanName, aiName),
    [humanName, aiName],
  );

  // Core game state.
  const [cells, setCells] = useState<Cells>(() => createBoard());
  const [movelist, setMovelist] = useState<Movelist>([]);
  const [thinkMs, setThinkMs] = useState<number[]>([]);
  const [status, setStatus] = useState<SoloStatus>("playing");
  const [winLine, setWinLine] = useState<Coord[] | null>(null);
  const [result, setResult] = useState<GameResult | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [starter, setStarter] = useState<Player>(HUMAN);

  // Overlays / hints.
  const [threats, setThreats] = useState<Coord[]>([]);
  const [threatsOn, setThreatsOn] = useState(false);
  const [hintCol, setHintCol] = useState<number | null>(null);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [threatsUsed, setThreatsUsed] = useState(0);

  // Series.
  const [series, setSeries] = useState<{ c: number; a: number }>({ c: 0, a: 0 });

  // Clocks.
  const [elapsedMs, setElapsedMs] = useState(0);
  const [turnMs, setTurnMs] = useState(0);

  // The player to move derives from the board *and* the starter — without the
  // starter, move-count parity says "aqua" after the AI's first move of an
  // AI-opened game (rematch), and the human is locked out forever.
  const current = useMemo<Player>(
    () => playerToMove(cells, starter),
    [cells, starter],
  );

  // Refs for timing a turn / a move's think duration without re-rendering.
  // Initialized to 0 (impure Date.now() must not run during render) and set on
  // mount + at each turn boundary.
  const turnStartRef = useRef<number>(0);
  const moveStartRef = useRef<number>(0);
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const active = status === "playing" || status === "thinking";

  // ── Clocks: a single interval advances the active turn clock. ──
  useEffect(() => {
    if (!active) return;
    if (turnStartRef.current === 0) turnStartRef.current = Date.now();
    const tick = () => {
      setTurnMs(Date.now() - turnStartRef.current);
    };
    tick();
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [active]);

  // Bump total elapsed whenever a move lands (turnStart resets per turn).
  const resetTurnClock = useCallback(() => {
    turnStartRef.current = Date.now();
    setTurnMs(0);
  }, []);

  // ── Engine teardown on unmount. ──
  useEffect(() => {
    return () => {
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
      engineRef.current?.terminate();
      engineRef.current = null;
    };
  }, []);

  const seriesTarget = Math.floor(bestOf / 2) + 1;
  const seriesOver =
    bestOf > 1 && (series.c >= seriesTarget || series.a >= seriesTarget);

  // ── Persistence helpers. ──
  const persistProgress = useCallback(
    (nextCells: Cells, nextMoves: Movelist) => {
      if (isFull(nextCells)) return; // finished boards aren't "in progress"
      saveProgress({
        id,
        mode: "solo",
        difficulty,
        players: [players.human, players.ai],
        movelist: nextMoves,
        starter,
        toMove: playerToMove(nextCells, starter),
        moves: nextMoves.length,
        updatedAt: new Date().toISOString(),
      });
    },
    [id, difficulty, players, starter],
  );

  // Snapshot of the last finished game (for saveForCoach()).
  const finishedRef = useRef<{
    cells: Cells;
    movelist: Movelist;
    thinkMs: number[];
    result: GameResult;
  } | null>(null);

  const finishGame = useCallback(
    (
      finalCells: Cells,
      finalMoves: Movelist,
      finalThink: number[],
      outcome: GameResult,
      line: Coord[] | null,
    ) => {
      setStatus(outcome === "draw" ? "draw" : "won");
      setResult(outcome);
      setWinner(outcome === "draw" ? null : outcome);
      setWinLine(line);
      setThreats([]);
      setThreatsOn(false);
      setSeries((s) => {
        if (outcome === "draw") return s;
        return outcome === "c" ? { ...s, c: s.c + 1 } : { ...s, a: s.a + 1 };
      });
      clearProgress(id);
      // The full finished record is written lazily by saveForCoach(), but we
      // keep finalCells/think handy via closures used there.
      finishedRef.current = {
        cells: finalCells,
        movelist: finalMoves,
        thinkMs: finalThink,
        result: outcome,
      };
    },
    [id],
  );

  // ── AI move loop. ──
  const runAi = useCallback(
    async (boardAfterHuman: Cells, movesAfterHuman: Movelist, thinkAfterHuman: number[]) => {
      const engine = engineRef.current;
      if (!engine) return;
      moveStartRef.current = Date.now();
      let res;
      try {
        res = await engine.getMove(boardAfterHuman, difficulty);
      } catch {
        return; // engine cancelled / terminated mid-think
      }
      let col = res.bestCol;
      if (!canDrop(boardAfterHuman, col)) {
        // Defensive: fall back to the first legal column if the engine returned
        // a full/out-of-range one.
        const legal = legalColumns(boardAfterHuman);
        if (legal.length === 0) return;
        col = legal[0];
      }
      const elapsed = Date.now() - moveStartRef.current;
      const nextCells = drop(boardAfterHuman, col, AI);
      const nextMoves = [...movesAfterHuman, col];
      const nextThink = [...thinkAfterHuman, elapsed];
      const row = columnHeight(nextCells, col) - 1;
      const line = winningLineAt(nextCells, col, row);

      setCells(nextCells);
      setMovelist(nextMoves);
      setThinkMs(nextThink);
      setElapsedMs((e) => e + elapsed);

      if (line) {
        finishGame(nextCells, nextMoves, nextThink, AI, line);
        return;
      }
      if (isFull(nextCells)) {
        finishGame(nextCells, nextMoves, nextThink, "draw", null);
        return;
      }
      setStatus("playing");
      resetTurnClock();
      persistProgress(nextCells, nextMoves);
    },
    [difficulty, finishGame, persistProgress, resetTurnClock],
  );

  // ── Human move. ──
  const play = useCallback(
    (col: number) => {
      if (status !== "playing") return;
      if (current !== HUMAN) return;
      if (!canDrop(cells, col)) return;

      const elapsed = Date.now() - turnStartRef.current;
      const nextCells = drop(cells, col, HUMAN);
      const nextMoves = [...movelist, col];
      const nextThink = [...thinkMs, elapsed];
      const row = columnHeight(nextCells, col) - 1;
      const line = winningLineAt(nextCells, col, row);

      setCells(nextCells);
      setMovelist(nextMoves);
      setThinkMs(nextThink);
      setElapsedMs((e) => e + elapsed);
      setHintCol(null);
      setThreats([]);
      setThreatsOn(false);

      if (line) {
        finishGame(nextCells, nextMoves, nextThink, HUMAN, line);
        return;
      }
      if (isFull(nextCells)) {
        finishGame(nextCells, nextMoves, nextThink, "draw", null);
        return;
      }
      // Hand off to the AI.
      setStatus("thinking");
      resetTurnClock();
      void runAi(nextCells, nextMoves, nextThink);
    },
    [
      status,
      current,
      cells,
      movelist,
      thinkMs,
      finishGame,
      resetTurnClock,
      runAi,
    ],
  );

  // ── Hint. ──
  const hintsLeft = isPro ? Infinity : Math.max(0, freeHints - hintsUsed);
  const hintLocked = !isPro && hintsLeft <= 0;

  const requestHint = useCallback(async (): Promise<number | null> => {
    if (status !== "playing" || current !== HUMAN) return null;
    if (hintLocked) return null;
    const engine = engineRef.current;
    if (!engine) return null;
    let res;
    try {
      res = await engine.getBestMove(cells);
    } catch {
      return null;
    }
    if (!isPro) setHintsUsed((n) => n + 1);
    setHintCol(res.bestCol);
    if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    hintTimerRef.current = setTimeout(() => setHintCol(null), 4000);
    return res.bestCol;
  }, [status, current, hintLocked, cells, isPro]);

  // ── Threats. ──
  const threatsLeft = isPro ? Infinity : Math.max(0, freeThreats - threatsUsed);
  const threatsLocked = !isPro && !threatsOn && threatsLeft <= 0;

  const toggleThreats = useCallback(async () => {
    if (threatsOn) {
      setThreatsOn(false);
      setThreats([]);
      return;
    }
    if (threatsLocked) return;
    const engine = engineRef.current;
    if (!engine) return;
    let found: Coord[];
    try {
      // Opponent (aqua) threats against the human.
      found = await engine.getThreats(cells, AI);
    } catch {
      return;
    }
    if (!isPro) setThreatsUsed((n) => n + 1);
    setThreatsOn(true);
    setThreats(found);
  }, [threatsOn, threatsLocked, cells, isPro]);

  // ── Rematch / resign. ──
  const resetBoard = useCallback(
    (nextStarter: Player) => {
      engineRef.current?.cancel();
      setCells(createBoard());
      setMovelist([]);
      setThinkMs([]);
      setWinLine(null);
      setResult(null);
      setWinner(null);
      setThreats([]);
      setThreatsOn(false);
      setHintCol(null);
      setElapsedMs(0);
      setStarter(nextStarter);
      finishedRef.current = null;
      resetTurnClock();
      moveStartRef.current = Date.now();
      // If the AI starts, kick it off from the empty board.
      if (nextStarter === AI) {
        setStatus("thinking");
        void runAi(createBoard(), [], []);
      } else {
        setStatus("playing");
      }
    },
    [resetTurnClock, runAi],
  );

  const rematch = useCallback(() => {
    if (seriesOver) {
      // New series.
      setSeries({ c: 0, a: 0 });
    }
    resetBoard(starter === HUMAN ? AI : HUMAN);
  }, [seriesOver, resetBoard, starter]);

  const resign = useCallback(() => {
    if (status === "won" || status === "draw") return;
    engineRef.current?.cancel();
    finishGame(cells, movelist, thinkMs, AI, null);
  }, [status, cells, movelist, thinkMs, finishGame]);

  // ── Coach handoff. ──
  const saveForCoach = useCallback((): string => {
    const snap = finishedRef.current;
    const useMoves = snap?.movelist ?? movelist;
    const useThink = snap?.thinkMs ?? thinkMs;
    const useResult: GameResult = snap?.result ?? result ?? "draw";
    saveMatch({
      id,
      mode: "solo",
      difficulty,
      players: [players.human, players.ai],
      movelist: useMoves,
      starter,
      think_ms: useThink,
      result: useResult,
      createdAt: new Date().toISOString(),
    });
    return id;
  }, [id, difficulty, players, starter, movelist, thinkMs, result]);

  return {
    cells,
    movelist,
    thinkMs,
    status,
    current,
    winLine,
    result,
    winner,
    threats,
    threatsOn,
    hintCol,
    elapsedMs,
    turnMs,
    series,
    bestOf,
    seriesOver,
    hintsLeft,
    threatsLeft,
    starter,
    difficulty,
    players,
    play,
    requestHint,
    toggleThreats,
    rematch,
    resign,
    hintLocked,
    threatsLocked,
    saveForCoach,
  };
}

// ── Formatting helpers (shared by the view + controls). ──

/** mm:ss from milliseconds (e.g. 0:23, 1:43). */
export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Short think-time label, e.g. "4.3s" or "—" for the rail. */
export function formatThink(ms: number | undefined): string {
  if (ms === undefined) return "—";
  if (ms < 100) return "0.1s";
  return `${(ms / 1000).toFixed(1)}s`;
}
