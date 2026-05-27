"use client";

import Link from "next/link";
import { useState } from "react";
import { Avatar, Chip, Icon } from "@/components/ui";
import {
  CITIES,
  getMockLeaderboard,
  getMockPodium,
  type City,
  type LeaderboardPeriod,
} from "@/lib/mockData";
import styles from "./leaderboard.module.css";

const PODIUM_HEIGHTS = [130, 170, 110]; // display order: #2, #1, #3

export function LeaderboardView() {
  const [city, setCity] = useState<City>("Almaty");
  const [period, setPeriod] = useState<LeaderboardPeriod>("weekly");

  const rows = getMockLeaderboard(city, period);
  const podium = getMockPodium(city, period);

  return (
    <>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Leaderboard</h1>
          <p className={styles.subtitle}>Live ELO across 64 cities · resets monthly on the 1st</p>
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
        {rows.map((row, i) => (
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
              style={{ fontSize: 13, color: row.delta.startsWith("+") ? "var(--success)" : "var(--danger)" }}
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
