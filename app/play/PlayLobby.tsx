"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Board } from "@/components/board/Board";
import { Avatar, Button, Card, Chip, Icon, Toast, useToast } from "@/components/ui";
import { BOARD_COACH } from "@/lib/sampleBoards";
import { DAILY_PUZZLE } from "@/lib/mockData";
import type { Difficulty } from "@/engine/types";
import { listProgress, type ProgressRecord } from "@/lib/game/matchStore";
import { DifficultySelector } from "./DifficultySelector";
import styles from "./play.module.css";

/** Stable, URL-safe id for a new game. */
function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
}

function modeLabelFor(p: ProgressRecord): string {
  if (p.mode === "solo") {
    const d = p.difficulty ? `${p.difficulty[0].toUpperCase()}${p.difficulty.slice(1)}` : "AI";
    return `${d} AI · Casual`;
  }
  if (p.mode === "ranked") return "Ranked";
  return "Duel link · Casual";
}

function turnLabel(p: ProgressRecord): { text: string; mine: boolean } {
  // The local human is coral by convention.
  const mine = p.toMove === "c";
  return { text: mine ? "Your turn" : "Their turn", mine };
}

function opponentName(p: ProgressRecord): string {
  const opp = p.players.find((pl) => !pl.human) ?? p.players[1];
  return opp?.name ?? "Opponent";
}

export function PlayLobby() {
  const router = useRouter();
  const [difficulty, setDifficulty] = useState<Difficulty>("hard");
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const { message: toast, show: showToast } = useToast(4200);

  // If /r/new bounced us back (backend unreachable), explain it once and clean
  // the URL so a refresh doesn't re-fire. Read from location to avoid the
  // useSearchParams() Suspense requirement.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("duel") === "unavailable") {
      showToast(
        "Couldn’t open a duel room — the backend isn’t reachable yet. Try again shortly.",
      );
      window.history.replaceState(null, "", "/play");
    }
  }, [showToast]);

  // Sync the in-progress list from localStorage: once on mount, and whenever
  // another tab writes to storage (e.g. finishing a game elsewhere).
  useEffect(() => {
    const sync = () => setProgress(listProgress());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  const startSolo = () => {
    router.push(`/game/${newId()}?mode=solo&difficulty=${difficulty}`);
  };

  const startRanked = () => {
    // Fallback: ranked matchmaking isn't wired yet, so we drop into a solo game
    // vs a calibrated bot (labelled as such in the game top bar).
    router.push(`/game/${newId()}?mode=ranked&difficulty=hard`);
  };

  const createRoom = () => {
    // GET /r/new mints an (anonymous) host + a duel_rooms row, then 303s into
    // the room. On backend failure it bounces back to /play?duel=unavailable,
    // which the effect above surfaces as a toast.
    router.push("/r/new");
  };

  const dailyBoard = useMemo(() => BOARD_COACH, []);

  return (
    <div className={styles.lobby}>
      {/* Header */}
      <header className={styles.head}>
        <div className={styles.kicker}>Good to see you</div>
        <h1 className={styles.title}>Pick your fight.</h1>
      </header>

      {/* Three mode cards */}
      <div className={styles.modes}>
        {/* ── Solo / AI ── */}
        <div className={`${styles.mode} ${styles.modePrimary}`}>
          <span className={styles.accent} data-accent="coral" />
          <div className={styles.modeKicker} data-accent="coral">Solo</div>
          <h3 className={styles.modeTitle}>Against the machine</h3>
          <p className={styles.modeBody}>Drill on demand. Pick your poison.</p>

          <DifficultySelector value={difficulty} onChange={setDifficulty} />

          <Button
            variant="primary"
            size="lg"
            full
            iconRight={<Icon name="arrow" size={14} />}
            onClick={startSolo}
          >
            Start training
          </Button>
          <div className={styles.modeFoot}>
            <span>Train vs <span className={styles.footStrong}>{difficulty}</span> AI</span>
            <span className="mono">human is coral</span>
          </div>
        </div>

        {/* ── Duel by link ── */}
        <div className={styles.mode}>
          <span className={styles.accent} data-accent="aqua" />
          <div className={styles.modeKicker} data-accent="aqua">Duel</div>
          <h3 className={styles.modeTitle}>Link a friend</h3>
          <p className={styles.modeBody}>One URL. Anywhere, any device.</p>

          <div className={`${styles.roomCode} mono`}>
            <span>
              <span className={styles.roomMute}>drop4.gg/r/</span>
              <span>new-room</span>
            </span>
            <Icon name="link" size={14} />
          </div>
          <Button
            variant="secondary"
            size="lg"
            full
            icon={<Icon name="link" size={14} />}
            onClick={createRoom}
          >
            Create room link
          </Button>
          <div className={styles.modeNote}>Realtime · play as a guest</div>
        </div>

        {/* ── Ranked / Quick match ── */}
        <div className={styles.mode}>
          <span className={styles.accent} data-accent="coral" />
          <div className={styles.modeKicker} data-accent="coral">Ranked</div>
          <h3 className={styles.modeTitle}>Quick match</h3>
          <p className={styles.modeBody}>Find a stranger near your ELO.</p>

          <div className={styles.eloBox}>
            <div className={styles.eloHead}>
              <span>Your ELO</span>
              <span>Match range</span>
            </div>
            <div className={styles.eloRow}>
              <span className={`${styles.eloValue} mono`}>1798</span>
              <span className={`${styles.eloRange} mono`}>1750 — 1850</span>
            </div>
            <div className={styles.eloBar}>
              <span className={styles.eloBarFill} />
              <span className={styles.eloBarKnob} />
            </div>
          </div>
          <Button
            variant="secondary"
            size="lg"
            full
            icon={<Icon name="bolt" size={13} />}
            onClick={startRanked}
          >
            Quick match
          </Button>
          <div className={styles.modeNote}>Fallback: vs calibrated bot</div>
        </div>
      </div>

      {/* Continue + Daily challenge */}
      <div className={styles.bottom}>
        <Card padded={false} className={styles.continue}>
          <div className={styles.continueHead}>
            <span className={styles.continueTitle}>Continue</span>
            <span className={styles.continueCount}>
              {progress.length} in progress
            </span>
          </div>
          {progress.length === 0 ? (
            <div className={styles.continueEmpty}>
              No games in progress. Start one above — it&apos;ll show up here so you
              can pick it back up.
            </div>
          ) : (
            progress.slice(0, 4).map((p, i) => {
              const turn = turnLabel(p);
              const opp = opponentName(p);
              return (
                <button
                  key={p.id}
                  type="button"
                  className={styles.continueRow}
                  data-last={i === Math.min(progress.length, 4) - 1}
                  onClick={() =>
                    router.push(
                      `/game/${p.id}?mode=${p.mode}${p.difficulty ? `&difficulty=${p.difficulty}` : ""}`,
                    )
                  }
                >
                  <Avatar name={opp} size={32} />
                  <div className={styles.continueWho}>
                    <div className={styles.continueName}>{opp}</div>
                    <div className={styles.continueMode}>{modeLabelFor(p)}</div>
                  </div>
                  <div className={`${styles.continueScore} mono`}>
                    Move {p.moves}
                  </div>
                  <Chip tone={turn.mine ? "coral" : "neutral"} size="md">
                    {turn.text}
                  </Chip>
                </button>
              );
            })
          )}
        </Card>

        {/* Daily challenge */}
        <Card padded className={styles.daily}>
          <div>
            <div className={styles.dailyHead}>
              <Chip tone="gold" size="md" icon={<Icon name="flame" size={11} />}>
                Daily puzzle
              </Chip>
              <span className={`${styles.dailyNum} mono`}>#{DAILY_PUZZLE.number}</span>
            </div>
            <h3 className={styles.dailyTitle}>{DAILY_PUZZLE.title}</h3>
            <p className={styles.dailyBlurb}>
              {DAILY_PUZZLE.blurb} {DAILY_PUZZLE.solvedToday} players solved today.
            </p>
          </div>
          <div className={styles.dailyBoard}>
            <Board cells={dailyBoard} size="sm" disabled />
          </div>
          <Button
            variant="outline"
            size="md"
            full
            href="/puzzle/today"
            iconRight={<Icon name="arrow" size={13} />}
          >
            Solve it
          </Button>
        </Card>
      </div>

      <Toast message={toast} />
    </div>
  );
}
