"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Avatar, Button, Card, Chip, Icon } from "@/components/ui";
import { listMatches, type MatchRecord } from "@/lib/game/matchStore";
import styles from "./coach-index.module.css";

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** "3 min ago", "2 h ago", "yesterday", or a short date. */
function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (!Number.isFinite(then)) return "";
  const diffSec = Math.max(0, Math.floor((Date.now() - then) / 1000));
  if (diffSec < 60) return "just now";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d < 2) return "yesterday";
  if (d < 7) return `${d} d ago`;
  return new Date(iso).toLocaleDateString();
}

function opponentName(rec: MatchRecord): string {
  const opp = rec.players.find((p) => !p.human) ?? rec.players[1];
  return opp?.name ?? "Opponent";
}

function modeLabel(rec: MatchRecord): string {
  const mode = capitalize(rec.mode);
  const diff = rec.difficulty ? ` · ${capitalize(rec.difficulty)}` : "";
  return `${mode}${diff} · ${rec.movelist.length} moves`;
}

function resultFor(
  rec: MatchRecord,
): { text: string; tone: "coral" | "aqua" | "neutral" } {
  if (rec.result === "draw") return { text: "Draw", tone: "neutral" };
  // Find which side the local viewer was on. Defaults to coral if no
  // `human` flag is set (solo records pre-fix duel save). Then we just
  // compare the result chip against the viewer's chip.
  const me = rec.players.find((p) => p.human);
  const myChip = me?.chip ?? "c";
  const tone = rec.result === "c" ? "coral" : "aqua";
  const youWon = rec.result === myChip;
  if (youWon) return { text: "You won", tone };
  return { text: `${opponentName(rec)} won`, tone };
}

export function CoachIndex() {
  const router = useRouter();
  const [matches, setMatches] = useState<MatchRecord[] | null>(null);

  // Sync from localStorage on mount + when another tab updates it (e.g. you
  // finish a game in tab A, this index in tab B refreshes).
  useEffect(() => {
    const sync = () => setMatches(listMatches());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  if (matches === null) {
    // First render before hydration completes — keep the shell quiet.
    return null;
  }

  if (matches.length === 0) {
    return (
      <Card padded className={styles.empty}>
        <div className={styles.emptyIcon} aria-hidden>
          <Icon name="cpu" size={28} />
        </div>
        <div className={styles.emptyTitle}>No games to analyze yet</div>
        <p className={styles.emptyBody}>
          Play a solo game (or a duel), and you&apos;ll see it here with a full
          breakdown. The coach replays every move through the engine — accuracy,
          blunders, missed threats — then writes the story.
        </p>
        <Button
          variant="primary"
          size="md"
          href="/play"
          iconRight={<Icon name="arrow" size={13} />}
        >
          Play a game
        </Button>
      </Card>
    );
  }

  return (
    <ul className={styles.list}>
      {matches.map((rec) => {
        const opp = opponentName(rec);
        const result = resultFor(rec);
        return (
          <li key={rec.id}>
            <button
              type="button"
              className={styles.row}
              onClick={() => router.push(`/coach/${rec.id}`)}
              aria-label={`Open analysis: ${opp}, ${result.text}, ${relativeTime(rec.createdAt)}`}
            >
              <Avatar name={opp} size={40} />
              <div className={styles.who}>
                <div className={styles.name}>{opp}</div>
                <div className={styles.meta}>
                  {modeLabel(rec)} · {relativeTime(rec.createdAt)}
                </div>
              </div>
              <Chip tone={result.tone} size="md">
                {result.text}
              </Chip>
              <Icon name="chevR" size={14} className={styles.chevron} />
            </button>
          </li>
        );
      })}
    </ul>
  );
}
