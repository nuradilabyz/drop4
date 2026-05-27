import type { CSSProperties } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Icon } from "@/components/ui/Icon";
import type { Player } from "@/engine/types";
import styles from "./PlayerPane.module.css";

export interface MoveRailItem {
  n: number;
  player: Player;
  /** e.g. "col 4" */
  label: string;
  /** think time, e.g. "4.3s" or "—" */
  dur?: string;
}

export interface PlayerPaneProps {
  name: string;
  rating?: number;
  city?: string;
  chip: Player;
  active?: boolean;
  /** Formatted clock, e.g. "0:23". */
  timer?: string;
  /** Highlight the timer as low (red). */
  timerLow?: boolean;
  series?: string;
  winRate?: string;
  moves?: MoveRailItem[];
  totalMoves?: number;
  /** Hide the stats + move rail (compact modes). */
  compact?: boolean;
}

const chipVar = (chip: Player): CSSProperties =>
  ({ "--pchip": chip === "c" ? "var(--coral)" : "var(--aqua)" }) as CSSProperties;

export function PlayerPane({
  name,
  rating,
  city,
  chip,
  active = false,
  timer = "0:00",
  timerLow = false,
  series,
  winRate,
  moves = [],
  totalMoves,
  compact = false,
}: PlayerPaneProps) {
  return (
    <div className={styles.pane} style={chipVar(chip)}>
      <div className={styles.card} data-active={active}>
        <div className={styles.head}>
          <Avatar name={name} size={48} ring={active ? "var(--pchip)" : undefined} />
          <div className={styles.identity}>
            <div className={styles.name}>{name}</div>
            <div className={styles.meta}>
              {city && (
                <>
                  <Icon name="globe" size={11} /> {city}
                </>
              )}
              {rating !== undefined && (
                <>
                  {city && <span style={{ opacity: 0.5 }}>·</span>}
                  <span className="mono">{rating}</span>
                </>
              )}
            </div>
          </div>
          <span className={styles.chipDot} />
        </div>

        <div className={styles.timerRow}>
          <span className={styles.timerLabel}>Turn</span>
          <span className={styles.timer} data-active={active} data-low={timerLow}>
            {timer}
          </span>
        </div>

        {active && (
          <span className={styles.turnBadge}>
            <span className={styles.pulse} />
            Your turn
          </span>
        )}
      </div>

      {!compact && (series || winRate) && (
        <div className={styles.stats}>
          {series !== undefined && (
            <div className={styles.statBox}>
              <div className={styles.statLabel}>Series</div>
              <div
                className={styles.statValue}
                style={{ color: chip === "c" ? "var(--coral)" : "var(--aqua)" }}
              >
                {series}
              </div>
            </div>
          )}
          {winRate !== undefined && (
            <div className={styles.statBox}>
              <div className={styles.statLabel}>Win rate</div>
              <div className={styles.statValue}>{winRate}</div>
            </div>
          )}
        </div>
      )}

      {!compact && (
        <div className={styles.rail}>
          <div className={styles.railHead}>
            <span className={styles.railTitle}>Last moves</span>
            <span className={styles.railCount}>
              {totalMoves ?? moves[0]?.n ?? 0} / —
            </span>
          </div>
          <div className={styles.railList}>
            {moves.length === 0 ? (
              <span className={styles.empty}>No moves yet</span>
            ) : (
              moves.map((m, i) => (
                <div key={m.n} className={styles.railRow} data-latest={i === 0}>
                  <span className={styles.railNum}>{m.n}.</span>
                  <span
                    className={styles.railChip}
                    style={{
                      background: m.player === "c" ? "var(--coral)" : "var(--aqua)",
                    }}
                  />
                  <span>{m.label}</span>
                  <span className={styles.railDur}>{m.dur ?? "—"}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
