"use client";

import { useState } from "react";
import { Avatar, Card, Chip, Icon } from "@/components/ui";
import { getLandingLeaderboard, type LeaderboardPeriod, type LeaderboardRow } from "@/lib/mockData";
import styles from "./landing.module.css";

const WEEKLY = getLandingLeaderboard();
// All-time tweaks the deltas so the toggle is visibly live.
const ALLTIME: LeaderboardRow[] = WEEKLY.map((r) => ({
  ...r,
  delta: `+${r.elo - 1700}`,
}));

/** City leaderboard card on the landing with a Weekly / All-time toggle. */
export function LeaderboardPreview() {
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const rows = period === "weekly" ? WEEKLY : ALLTIME;

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
            style={{ fontSize: 13, color: row.delta.startsWith("+") ? "var(--success)" : "var(--danger)" }}
          >
            {row.delta}
          </div>
        </div>
      ))}
    </Card>
  );
}
