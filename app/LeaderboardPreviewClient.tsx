"use client";

import { useState } from "react";
import { Avatar, Card, Chip, Icon } from "@/components/ui";
import styles from "./landing.module.css";

export type LbPeriod = "weekly" | "alltime";

export interface LbRow {
  rank: number;
  username: string;
  name: string;
  elo: number;
  delta: string;
  city: string;
  isSelf: boolean;
}

interface Props {
  weekly: LbRow[];
  alltime: LbRow[];
  /** Almaty by default — shown above the toggle. */
  city: string;
}

/**
 * Period toggle (Weekly / All-time) over data the server has already fetched.
 * No client-side data fetching, no mock fallback — the parent server
 * component is responsible for getting real rows here. `isSelf` is set only
 * when the row's username matches the *real* signed-in user, so unsigned
 * visitors never see a stranger's row highlighted as "You".
 */
export function LeaderboardPreviewClient({ weekly, alltime, city }: Props) {
  const [period, setPeriod] = useState<LbPeriod>("weekly");
  const rows = period === "weekly" ? weekly : alltime;

  return (
    <Card padded={false} className={styles.lbCard}>
      <div className={styles.lbHead}>
        <div className={styles.lbCity}>
          <Icon name="globe" size={14} color="var(--text-dim)" />
          <span>
            {city} · {period === "weekly" ? "This week" : "All-time"}
          </span>
        </div>
        <div className={styles.lbToggle}>
          <button
            type="button"
            className={styles.chipBtn}
            onClick={() => setPeriod("weekly")}
            aria-pressed={period === "weekly"}
          >
            <Chip tone={period === "weekly" ? "neutral" : "outline"} size="sm">
              Weekly
            </Chip>
          </button>
          <button
            type="button"
            className={styles.chipBtn}
            onClick={() => setPeriod("alltime")}
            aria-pressed={period === "alltime"}
          >
            <Chip tone={period === "alltime" ? "neutral" : "outline"} size="sm">
              All-time
            </Chip>
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div
          className={styles.lbRow}
          style={{
            gridTemplateColumns: "1fr",
            color: "var(--text-mute)",
            fontSize: 14,
            justifyItems: "center",
            borderBottom: "none",
            padding: "28px 22px",
          }}
        >
          Be the first to claim a spot.
        </div>
      ) : (
        rows.map((row, i) => {
          const isGold = row.rank === 1;
          return (
            <div
              key={row.username}
              className={[styles.lbRow, row.isSelf && styles.lbSelf]
                .filter(Boolean)
                .join(" ")}
              style={i === rows.length - 1 ? { borderBottom: "none" } : undefined}
            >
              <div
                className={`${styles.lbRank} mono`}
                style={isGold ? { color: "var(--gold)" } : undefined}
              >
                {String(row.rank).padStart(2, "0")}
              </div>
              <div className={styles.lbPlayer}>
                <Avatar name={row.name} size={28} />
                <span className={row.isSelf ? styles.lbSelfName : styles.lbName}>
                  {row.name}
                </span>
                {row.isSelf && (
                  <Chip tone="coral" size="sm">
                    You
                  </Chip>
                )}
                {isGold && !row.isSelf && (
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
          );
        })
      )}
    </Card>
  );
}
