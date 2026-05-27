"use client";

/**
 * Accuracy / Best moves / Missed threats / Avg think tiles (coach.jsx
 * InsightStat grid). Reads the coached side's `SideStats`.
 */

import type { SideStats } from "@/lib/coach/analyze";
import styles from "./InsightGrid.module.css";

export interface InsightGridProps {
  stats: SideStats;
  /** Opponent stats, used to compute the "+N vs opp" accuracy delta. */
  oppStats?: SideStats;
}

type Tone = "success" | "danger" | "coral" | undefined;

function Tile({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: Tone;
}) {
  const color =
    tone === "success"
      ? "var(--success)"
      : tone === "danger"
        ? "var(--danger)"
        : tone === "coral"
          ? "var(--coral)"
          : "var(--text)";
  return (
    <div className={styles.tile}>
      <span className={styles.label}>{label}</span>
      <span className={styles.valueRow}>
        <span className={styles.value} style={{ color }}>
          {value}
        </span>
        {sub && <span className={styles.sub}>{sub}</span>}
      </span>
    </div>
  );
}

function fmtThink(ms: number | null): string {
  if (ms === null) return "—";
  return `${(ms / 1000).toFixed(1)}s`;
}

export function InsightGrid({ stats, oppStats }: InsightGridProps) {
  const [made, total] = stats.bestMoves;

  const accSub =
    oppStats && oppStats.accuracy > 0
      ? `${stats.accuracy - oppStats.accuracy >= 0 ? "+" : ""}${stats.accuracy - oppStats.accuracy} vs opp`
      : undefined;

  return (
    <div className={styles.grid}>
      <Tile
        label="Accuracy"
        value={`${stats.accuracy}%`}
        sub={accSub}
        tone={stats.accuracy >= 80 ? "success" : stats.accuracy < 55 ? "danger" : undefined}
      />
      <Tile label="Best moves" value={`${made}/${total}`} />
      <Tile
        label="Missed threats"
        value={String(stats.missedThreats)}
        tone={stats.missedThreats > 0 ? "danger" : "success"}
      />
      <Tile label="Avg think" value={fmtThink(stats.avgThinkMs)} />
    </div>
  );
}
