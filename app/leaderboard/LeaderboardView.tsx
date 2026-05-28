"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Avatar, Chip, Icon } from "@/components/ui";
import { createClient } from "@/lib/supabase/client";
import { getLeaderboard } from "@/lib/db/queries";
import {
  CITIES,
  getMockLeaderboard,
  getMockPodium,
  type City,
  type LeaderboardPeriod,
} from "@/lib/mockData";
import type { LeaderboardRow as CloudRow } from "@/types/database";
import styles from "./leaderboard.module.css";

const PODIUM_HEIGHTS = [130, 170, 110]; // display order: #2, #1, #3
const SUPABASE_CONFIGURED = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

interface DisplayRow {
  rank: number;
  name: string;
  username: string;
  elo: number;
  delta: string;
  city: string;
  wins: number;
  losses: number;
  tag?: "gold" | "self";
}

function formatDelta(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`; // typographic minus matches the design
  return "0";
}

function adaptCloudRow(r: CloudRow): DisplayRow {
  return {
    rank: r.rank,
    name: r.display_name ?? r.username,
    username: r.username,
    elo: r.elo,
    delta: formatDelta(r.weekly_delta ?? 0),
    city: r.city ?? "",
    wins: r.wins,
    losses: r.losses,
    tag: r.rank === 1 ? "gold" : undefined,
  };
}

export function LeaderboardView() {
  const [city, setCity] = useState<City>("Almaty");
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");
  const [rows, setRows] = useState<DisplayRow[] | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  useEffect(() => {
    if (!SUPABASE_CONFIGURED) {
      setRows(getMockLeaderboard(city, period) as DisplayRow[]);
      setUsingMock(true);
      return;
    }

    let cancelled = false;
    setRows(null);

    (async () => {
      try {
        const supabase = createClient();
        const cloud = await getLeaderboard(supabase, { city, period });
        if (cancelled) return;
        if (cloud.length === 0) {
          // City has no players yet — show the mock for visual richness rather
          // than an empty page, but flag so we can label it.
          setRows(getMockLeaderboard(city, period) as DisplayRow[]);
          setUsingMock(true);
        } else {
          setRows(cloud.map(adaptCloudRow));
          setUsingMock(false);
        }
      } catch {
        if (cancelled) return;
        setRows(getMockLeaderboard(city, period) as DisplayRow[]);
        setUsingMock(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [city, period]);

  // Podium is the top 3 rendered in the order [#2, #1, #3] for visual balance.
  const podium = useMemo<DisplayRow[]>(() => {
    if (!rows) return [];
    if (rows.length >= 3) {
      return [rows[1], rows[0], rows[2]];
    }
    // Fall back to the mock podium when there aren't enough cloud rows yet.
    return getMockPodium(city, period) as DisplayRow[];
  }, [rows, city, period]);

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Leaderboard</h1>
          <p className={styles.subtitle}>
            Live ELO across 64 cities · resets monthly on the 1st
            {usingMock && rows && (
              <>
                {" · "}
                <span style={{ color: "var(--text-mute)" }}>
                  demo data (no players from {city} yet)
                </span>
              </>
            )}
          </p>
        </div>
        <div className={styles.controls}>
          <label className={styles.cityField}>
            <Icon name="globe" size={13} color="var(--text-dim)" />
            <select
              className={styles.citySelect}
              value={city}
              onChange={(e) => setCity(e.target.value as City)}
              aria-label="City"
            >
              {CITIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <Icon name="chevD" size={11} color="var(--text-dim)" />
          </label>
          <div className={styles.periodToggle}>
            <button
              type="button"
              className={[styles.periodBtn, period === "weekly" && styles.periodOn].filter(Boolean).join(" ")}
              onClick={() => setPeriod("weekly")}
            >
              This week
            </button>
            <button
              type="button"
              className={[styles.periodBtn, period === "alltime" && styles.periodOn].filter(Boolean).join(" ")}
              onClick={() => setPeriod("alltime")}
            >
              All-time
            </button>
          </div>
        </div>
      </div>

      {/* Podium */}
      <div className={styles.podium}>
        {podium.map((p, i) => {
          const isFirst = p.rank === 1;
          return (
            <div
              key={p.username}
              className={[styles.podiumCard, isFirst && styles.podiumFirst].filter(Boolean).join(" ")}
              style={{ height: PODIUM_HEIGHTS[i] }}
            >
              <div className={styles.podiumTop}>
                <span
                  className={`${styles.podiumRank} mono`}
                  style={{
                    color: isFirst ? "var(--gold)" : p.rank === 3 ? "var(--coral)" : "var(--text-dim)",
                  }}
                >
                  #{p.rank}
                </span>
                {isFirst && <Icon name="crown" size={20} color="var(--gold)" />}
              </div>
              <div className={styles.podiumPlayer}>
                <Avatar name={p.name} size={36} />
                <div>
                  <div className={styles.podiumName}>{p.name}</div>
                  <div className={`${styles.podiumElo} mono`}>{p.elo}</div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full table */}
      <div className={styles.table}>
        <div className={`${styles.row} ${styles.rowHead}`}>
          <span>#</span>
          <span>Player</span>
          <span>ELO</span>
          <span>Δ week</span>
          <span className={styles.hideSm}>City</span>
          <span className={styles.hideSm}>Record</span>
        </div>
        {rows === null && (
          <div className={`${styles.row}`} style={{ color: "var(--text-mute)", justifyContent: "center" }}>
            Loading…
          </div>
        )}
        {rows?.map((row, i) => (
          <div
            key={row.username}
            className={[styles.row, row.tag === "self" && styles.rowSelf].filter(Boolean).join(" ")}
            style={i === rows.length - 1 ? { borderBottom: "none" } : undefined}
          >
            <span
              className={`${styles.cellRank} mono`}
              style={row.tag === "gold" ? { color: "var(--gold)" } : undefined}
            >
              {String(row.rank).padStart(2, "0")}
            </span>
            <span className={styles.cellPlayer}>
              <Avatar name={row.name} size={30} />
              <Link href={`/profile/${row.username}`} className={row.tag === "self" ? styles.selfName : styles.name}>
                {row.name}
              </Link>
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
            </span>
            <span className={`${styles.cellElo} mono`}>{row.elo}</span>
            <span
              className="mono"
              style={{ fontSize: 13, color: row.delta.startsWith("+") ? "var(--success)" : row.delta === "0" ? "var(--text-mute)" : "var(--danger)" }}
            >
              {row.delta}
            </span>
            <span className={`${styles.cellCity} ${styles.hideSm}`}>{row.city}</span>
            <span className={`${styles.cellRecord} ${styles.hideSm} mono`}>
              {row.wins}W · {row.losses}L
            </span>
          </div>
        ))}
      </div>
    </>
  );
}
