"use client";

/**
 * AI Coach analysis screen (client). Mirrors ../screens/coach.jsx:
 *   3-column body — [board + EvalBar + playback] | [move timeline] |
 *   [overall verdict + "What the coach saw" + insight grid + patterns].
 *
 * Data flow:
 *   1. Load the finished match. localStorage `drop4:match:<id>` first; if absent
 *      and the user is authed, fall back to fetching from Supabase by id.
 *   2. POST { matchId, movelist, players, result, mode, isPro } → /api/coach.
 *   3. Render the analysis. Scrubbing sets the displayed ply and re-renders the
 *      Board at `fromMovelist(movelist.slice(0, ply + 1))`.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Board } from "@/components/board/Board";
import {
  EvalBar,
  InsightGrid,
  MoveTimeline,
  PatternRow,
  PlaybackControls,
} from "@/components/coach";
import { Button, Chip, Icon } from "@/components/ui";
import { detectThreats } from "@/engine";
import {
  fromMovelist,
  winningLineForMovelist,
  type Cells,
  type Coord,
  type Player,
} from "@/engine/types";
import type { CoachAnalysis } from "@/lib/coach/analyze";
import type { Narration } from "@/lib/coach/llm";
import styles from "./coach.module.css";

// ── Match handoff contract (frozen) ─────────────────────────────────
interface PlayerMeta {
  name: string;
  rating?: number;
  city?: string;
}
interface StoredMatch {
  id: string;
  mode: string;
  difficulty?: string;
  players: { c: PlayerMeta; a: PlayerMeta };
  movelist: number[];
  think_ms?: number[];
  result: "c" | "a" | "draw";
  createdAt: number | string;
}

interface ApiResponse {
  analysis: CoachAnalysis;
  narration: Narration;
  cached: boolean;
}

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; match: StoredMatch; data: ApiResponse };

/**
 * Coerce the `players` field into the { c, a } shape the coach expects.
 * The solo/duel matchStore persists `players` as an ordered array
 * [player1 ('c'), player2 ('a')]; older/other records may already be { c, a }.
 */
function normalizePlayers(p: unknown): { c: PlayerMeta; a: PlayerMeta } {
  const fallback = { c: { name: "You" }, a: { name: "Opponent" } };
  if (!p) return fallback;
  if (Array.isArray(p)) {
    return {
      c: (p[0] as PlayerMeta) ?? fallback.c,
      a: (p[1] as PlayerMeta) ?? fallback.a,
    };
  }
  const o = p as { c?: PlayerMeta; a?: PlayerMeta };
  return { c: o.c ?? fallback.c, a: o.a ?? fallback.a };
}

/** Read a finished match from localStorage. */
function readLocalMatch(id: string): StoredMatch | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(`drop4:match:${id}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredMatch;
    if (!Array.isArray(parsed.movelist) || parsed.movelist.length === 0) return null;
    return { ...parsed, players: normalizePlayers((parsed as { players?: unknown }).players) };
  } catch {
    return null;
  }
}

/** Map DB result ('p1'|'p2'|'draw') → handoff ('c'|'a'|'draw'). */
function mapDbResult(r: string | null | undefined): "c" | "a" | "draw" {
  if (r === "p1") return "c";
  if (r === "p2") return "a";
  return "draw";
}

/** Fall back to Supabase for an authed user when there's no local match. */
async function fetchDbMatch(id: string): Promise<StoredMatch | null> {
  try {
    const { createClient } = await import("@/lib/supabase/client");
    const supabase = createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (!auth.user) return null;

    const { data: match } = await supabase
      .from("matches")
      .select("id, mode, movelist, think_ms, result, player1_id, player2_id, created_at")
      .eq("id", id)
      .maybeSingle();
    if (!match?.movelist || match.movelist.length === 0) return null;

    return {
      id: match.id,
      mode: match.mode,
      players: {
        c: { name: "You" },
        a: { name: match.player2_id ? "Opponent" : "Drop4 AI" },
      },
      movelist: match.movelist,
      think_ms: match.think_ms ?? undefined,
      result: mapDbResult(match.result),
      createdAt: match.created_at,
    };
  } catch {
    return null;
  }
}

export interface CoachViewProps {
  matchId: string;
  isPro: boolean;
}

export function CoachView({ matchId, isPro }: CoachViewProps) {
  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [ply, setPly] = useState(0); // 0-indexed displayed ply
  const [playing, setPlaying] = useState(false);
  const [filter, setFilter] = useState<"all" | "key">("all");

  // Load match → analyze.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const match = readLocalMatch(matchId) ?? (await fetchDbMatch(matchId));
      if (cancelled) return;
      if (!match) {
        setState({
          status: "error",
          message: "We couldn't find this game. It may have expired from this device.",
        });
        return;
      }

      try {
        const res = await fetch("/api/coach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            matchId: match.id,
            movelist: match.movelist,
            players: match.players,
            thinkMs: match.think_ms,
            result: match.result,
            mode: match.mode,
            you: "c",
            isPro,
          }),
        });
        if (!res.ok) throw new Error(`Coach request failed (${res.status})`);
        const data = (await res.json()) as ApiResponse;
        if (cancelled) return;
        setState({ status: "ready", match, data });
        setPly(Math.max(0, data.analysis.totalMoves - 1));
      } catch (err) {
        if (cancelled) return;
        setState({
          status: "error",
          message: err instanceof Error ? err.message : "Analysis failed.",
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [matchId, isPro]);

  if (state.status === "loading") {
    return (
      <div className={styles.center}>
        <span className={styles.spinner} aria-hidden="true" />
        <p className={styles.muted}>Analyzing your game…</p>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className={styles.center}>
        <Icon name="cpu" size={28} />
        <p className={styles.muted}>{state.message}</p>
        <Button variant="secondary" size="md" href="/play" icon={<Icon name="play" size={13} />}>
          Play a game
        </Button>
      </div>
    );
  }

  return (
    <Ready
      match={state.match}
      data={state.data}
      ply={ply}
      setPly={setPly}
      playing={playing}
      setPlaying={setPlaying}
      filter={filter}
      setFilter={setFilter}
      isPro={isPro}
    />
  );
}

function Ready({
  match,
  data,
  ply,
  setPly,
  playing,
  setPlaying,
  filter,
  setFilter,
  isPro,
}: {
  match: StoredMatch;
  data: ApiResponse;
  ply: number;
  setPly: (p: number) => void;
  playing: boolean;
  setPlaying: (p: boolean) => void;
  filter: "all" | "key";
  setFilter: (f: "all" | "key") => void;
  isPro: boolean;
}) {
  const { analysis, narration, cached } = data;
  const total = analysis.totalMoves;
  const youName = match.players.c?.name || "You";
  const oppName = match.players.a?.name || "Opponent";

  // Board state at the current ply: moves 0..ply inclusive.
  const prefix = useMemo(
    () => match.movelist.slice(0, ply + 1),
    [match.movelist, ply],
  );
  const cells: Cells = useMemo(() => fromMovelist(prefix), [prefix]);

  // Win line only on the final, won position.
  const winLine: Coord[] | null = useMemo(() => {
    const isLast = ply === total - 1;
    return isLast ? winningLineForMovelist(prefix) : null;
  }, [prefix, ply, total]);

  // Threats for the side that just moved (shows the danger they created).
  const movedPlayer: Player = ply % 2 === 0 ? "c" : "a";
  const threats: Coord[] = useMemo(
    () => (cells.some((c) => c.length) ? detectThreats(cells, movedPlayer) : []),
    [cells, movedPlayer],
  );

  const move = analysis.moves[ply];
  const annotationMap = useMemo(() => {
    const m: Record<number, string> = {};
    for (const a of narration.moveAnnotations) m[a.n] = a.text;
    return m;
  }, [narration.moveAnnotations]);

  const scrub = useCallback(
    (p: number) => {
      setPlaying(false);
      setPly(Math.max(0, Math.min(total - 1, p)));
    },
    [setPlaying, setPly, total],
  );

  // Result chip.
  const resultTone = match.result === "c" ? "coral" : match.result === "a" ? "aqua" : "neutral";
  const resultText =
    match.result === "draw"
      ? "Draw"
      : match.result === "c"
        ? `${youName} won`
        : `${oppName} won`;

  const evalText = move ? formatEval(move.player === "c" ? move.evalAfter : -move.evalAfter, move.isMate) : "0.0";
  const moveTag = move?.tag;

  return (
    <div className={styles.shell}>
      {/* Top bar */}
      <header className={styles.topbar}>
        <div className={styles.topLeft}>
          <Button
            variant="ghost"
            size="sm"
            href="/play"
            icon={<Icon name="chevL" size={13} />}
          >
            Exit
          </Button>
          <div className={styles.divider} />
          <div>
            <div className={styles.matchTitle}>
              {youName} vs {oppName}
            </div>
            <div className={styles.matchSub}>
              {capitalize(match.mode)}
              {cached ? " · cached" : ""} · {analysis.totalMoves} moves
            </div>
          </div>
        </div>
        <div className={styles.topRight}>
          <Chip tone={resultTone} size="md">
            {resultText}
          </Chip>
          {!isPro && (
            <Button
              variant="secondary"
              size="sm"
              href="/pricing"
              icon={<Icon name="crown" size={13} />}
            >
              Unlock full coach
            </Button>
          )}
          <Button
            variant="secondary"
            size="sm"
            href="/play"
            icon={<Icon name="refresh" size={13} />}
          >
            Rematch
          </Button>
        </div>
      </header>

      {/* 3-column body */}
      <div className={styles.body}>
        {/* ── Board column ── */}
        <section className={styles.boardCol}>
          <div className={styles.moveHeader}>
            <div>
              <div className={styles.kicker}>
                Move {ply + 1} of {total}
              </div>
              <div className={styles.playedRow}>
                {move ? (
                  <>
                    {move.player === "c" ? youName : oppName} played{" "}
                    <span className={styles.colMono}>col {move.col + 1}</span>
                    {moveTag && moveTag !== "normal" && (
                      <TagChip tag={moveTag} />
                    )}
                  </>
                ) : (
                  "Start"
                )}
              </div>
            </div>
            <div className={styles.evalBox}>
              <div className={styles.kicker}>Eval</div>
              <div
                className={styles.evalValue}
                style={{
                  color: evalAdvantageColor(move),
                }}
              >
                {evalText}
              </div>
            </div>
          </div>

          <div className={styles.boardWrap}>
            <Board
              cells={cells}
              size="lg"
              winLine={winLine}
              threats={threats}
              ghosting={!!winLine}
              showColLabels
            />
          </div>

          <EvalBar
            evals={analysis.evalBar}
            current={ply}
            onScrub={scrub}
            youLabel={youName}
            oppLabel={oppName}
          />

          <PlaybackControls
            current={ply}
            total={total}
            playing={playing}
            onChange={(p) => setPly(p)}
            onPlayingChange={setPlaying}
          />
        </section>

        {/* ── Move timeline column ── */}
        <section className={styles.timelineCol}>
          <MoveTimeline
            moves={analysis.moves}
            current={ply}
            annotations={annotationMap}
            filter={filter}
            onFilterChange={setFilter}
            onScrub={scrub}
          />
        </section>

        {/* ── Insights column ── */}
        <section className={styles.insightsCol}>
          <h3 className={styles.sectionTitle}>What the coach saw</h3>

          {/* Overall verdict */}
          <div className={styles.verdict}>{narration.overall}</div>

          {/* Coach cards (Pro-gated depth) */}
          {narration.whatTheCoachSaw.map((card) => (
            <CoachCard key={card.moveN} card={card} onReplay={() => scrub(card.moveN - 1)} />
          ))}

          {!isPro && analysis.keyMoments.length > 1 && (
            <div className={styles.proHint}>
              <Icon name="lock" size={13} />
              <span>
                {analysis.keyMoments.length - 1} more annotated moments with Pro.
              </span>
              <Button variant="ghost" size="sm" href="/pricing">
                Upgrade
              </Button>
            </div>
          )}

          {/* Insight grid */}
          <InsightGrid stats={analysis.stats.c} oppStats={analysis.stats.a} />

          {/* Patterns */}
          {narration.patterns.length > 0 && (
            <div className={styles.patterns}>
              <div className={styles.kicker}>Patterns spotted</div>
              <div className={styles.patternList}>
                {narration.patterns.map((p, i) => (
                  <PatternRow key={i} tone={p.tone} title={p.title} sub={p.sub} />
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function CoachCard({
  card,
  onReplay,
}: {
  card: Narration["whatTheCoachSaw"][number];
  onReplay: () => void;
}) {
  const lineText =
    card.engineLine.length > 0
      ? card.engineLine.slice(0, 4).map((c) => c + 1).join(" → ")
      : "—";
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <Icon name="bolt" size={13} color="var(--gold)" />
        <span className={styles.kicker}>{card.title}</span>
      </div>
      <p className={styles.cardBody}>{card.body}</p>
      <div className={styles.cardLine}>
        <span className={styles.lineIcon}>
          <Icon name="target" size={16} color="var(--gold)" />
        </span>
        <span className={styles.lineText}>
          <span className={styles.lineMain}>Engine line: {lineText}</span>
          <span className={styles.lineSub}>{formatEval(card.evalShift, false)} eval shift</span>
        </span>
        <Button variant="ghost" size="sm" onClick={onReplay}>
          Replay
        </Button>
      </div>
    </div>
  );
}

function TagChip({ tag }: { tag: string }) {
  const map: Record<string, { tone: "coral" | "gold" | "success" | "danger"; label: string; icon?: "spark" }> = {
    brilliant: { tone: "coral", label: "Brilliant", icon: "spark" },
    fork: { tone: "gold", label: "Fork" },
    good: { tone: "success", label: "Solid" },
    inaccuracy: { tone: "gold", label: "Inaccuracy" },
    miss: { tone: "danger", label: "Missed" },
    blunder: { tone: "danger", label: "Blunder" },
  };
  const m = map[tag];
  if (!m) return null;
  return (
    <Chip tone={m.tone} size="md" icon={m.icon ? <Icon name={m.icon} size={10} /> : undefined}>
      {m.label}
    </Chip>
  );
}

// ── formatting helpers ──────────────────────────────────────────────

const MATE_THRESHOLD = 90000;
const WIN_CP = 100000;

/** Format a mover-POV eval (cp) as "+1.4" or "+M5" / "-M3". */
function formatEval(cp: number, isMate: boolean): string {
  if (isMate || Math.abs(cp) >= MATE_THRESHOLD) {
    // distance encoded as |cp| - WIN_CP magnitude in the engine; approximate.
    const sign = cp >= 0 ? "+" : "-";
    const dist = Math.max(1, Math.round(Math.abs(Math.abs(cp) - WIN_CP)) || 1);
    return `${sign}M${dist}`;
  }
  const v = cp / 100;
  const sign = v >= 0 ? "+" : "";
  return `${sign}${v.toFixed(1)}`;
}

/** Color the eval value coral when 'you' (P1) are ahead, aqua when behind. */
function evalAdvantageColor(
  move: CoachAnalysis["moves"][number] | undefined,
): string {
  if (!move) return "var(--text)";
  // Convert to player-1 POV.
  const cPov = move.player === "c" ? move.evalAfter : -move.evalAfter;
  if (Math.abs(cPov) < 20) return "var(--text)";
  return cPov > 0 ? "var(--coral)" : "var(--aqua)";
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}
