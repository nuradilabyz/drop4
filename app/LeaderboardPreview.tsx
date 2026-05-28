"use client";

import { useEffect, useState } from "react";
import { Avatar, Card, Chip, Icon } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { getLeaderboard } from "@/lib/db/queries";
import {
  getLandingLeaderboard,
  type LeaderboardPeriod,
  type LeaderboardRow,
} from "@/lib/mockData";
import type { LeaderboardRow as CloudRow } from "@/types/database";
import styles from "./landing.module.css";

const SUPABASE_CONFIGURED = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const MOCK_WEEKLY = getLandingLeaderboard();
// All-time mock tweaks the deltas so the toggle is visibly live.
const MOCK_ALLTIME: LeaderboardRow[] = MOCK_WEEKLY.map((r) => ({
  ...r,
  delta: `+${r.elo - 1700}`,
}));

function formatDelta(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

function adapt(r: CloudRow): LeaderboardRow {
  return {
    rank: r.rank,
    name: r.display_name ?? r.username,
    username: r.username,
    elo: r.elo,
    delta: formatDelta(r.weekly_delta ?? 0),
    city: (r.city ?? "Almaty") as LeaderboardRow["city"],
    wins: r.wins,
    losses: r.losses,
    tag: r.rank === 1 ? "gold" : undefined,
  };
}

/** City leaderboard card on the landing with a Weekly / All-time toggle. */
export function LeaderboardPreview() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [rows, setRows] = useState<LeaderboardRow[]>(MOCK_WEEKLY);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setRows(period === "weekly" ? MOCK_WEEKLY : MOCK_ALLTIME);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const supabase = createClient();
        const cloud = await getLeaderboard(supabase, { city: "Almaty", period });
        if (cancelled) return;
        if (cloud.length === 0) {
          setRows(period === "weekly" ? MOCK_WEEKLY : MOCK_ALLTIME);
        } else {
          // Landing card is compact — top 5 is plenty.
          setRows(cloud.slice(0, 5).map(adapt));
        }
      } catch {
        if (cancelled) return;
        setRows(period === "weekly" ? MOCK_WEEKLY : MOCK_ALLTIME);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  return (
    <Card padded={false} className={styles.lbCard}>
      <div className={styles.lbHead}>
        <div className={styles.lbCity}>
          <Icon name="globe" size={14} color="var(--text-dim)" />
          <span>Almaty · {period === "weekly" ? "This week" : "All-time"}</span>
        </div>
        <div className={styles.lbToggle}>
          <button type="button" className={styles.chipBtn} onClick={() => setPeriod("weekly")} aria-pressed={period === "weekly"}>
            <Chip tone={period === "weekly" ? "neutral" : "outline"} size="sm">
              Weekly
            </Chip>
          </button>
          <button type="button" className={styles.chipBtn} onClick={() => setPeriod("alltime")} aria-pressed={period === "alltime"}>
            <Chip tone={period === "alltime" ? "neutral" : "outline"} size="sm">
              All-time
            </Chip>
          </button>
        </div>
      </div>

      {rows.map((row, i) => (
        <div
          key={row.username}
          className={[styles.lbRow, row.tag === "self" && styles.lbSelf].filter(Boolean).join(" ")}
          style={i === rows.length - 1 ? { borderBottom: "none" } : undefined}
        >
          <div className={`${styles.lbRank} mono`} style={row.tag === "gold" ? { color: "var(--gold)" } : undefined}>
            {String(row.rank).padStart(2, "0")}
          </div>
          <div className={styles.lbPlayer}>
            <Avatar name={row.name} size={28} />
            <span className={row.tag === "self" ? styles.lbSelfName : styles.lbName}>{row.name}</span>
            {row.tag === "self" && (
              <Chip tone="coral" size="sm">
                You
              </Chip>
            )}
            {row.tag === "gold" && (
              <Chip tone="gold" size="sm" icon={<Icon name="crown" size={10} />}>
                Champ
              </Chip>
            )}
          </div>
          <div className={`${styles.lbElo} mono`}>{row.elo}</div>
          <div
            className="mono"
            style={{
              fontSize: 13,
              color: row.delta.startsWith("+")
                ? "var(--success)"
                : row.delta === "0"
                  ? "var(--text-mute)"
                  : "var(--danger)",
            }}
          >
            {row.delta}
          </div>
        </div>
      ))}
    </Card>
  );
}
