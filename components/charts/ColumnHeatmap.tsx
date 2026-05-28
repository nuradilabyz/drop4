import styles from "./ColumnHeatmap.module.css";

export interface ColumnHeatmapProps {
  /** Opening preference as a fraction per column (7 entries). */
  columns: number[];
  /**
   * 1-based favourite column to highlight. When omitted, the bar with the
   * highest value is used. Ignored entirely in the empty state.
   */
  favoriteColumn?: number | null;
}

const COLUMN_NAMES = ["edge", "", "", "center", "", "", "edge"] as const;

/**
 * 7-column opening-preference bars (ported from profile.jsx). The favourite
 * column is painted coral; the rest are recessed surface bars.
 *
 * When there is no distribution data yet (every column is 0, i.e. the
 * per-column breakdown isn't recorded), we render an honest empty state
 * instead of faking a highlighted bar + a "you favor the center column"
 * claim. That keeps the chart from contradicting the "Favorite opening"
 * StatTile.
 */
export function ColumnHeatmap({ columns, favoriteColumn }: ColumnHeatmapProps) {
  const sum = columns.reduce((acc, v) => acc + v, 0);

  if (sum === 0) {
    return (
      <div className={styles.empty}>
        Not enough games yet to chart opening preference.
      </div>
    );
  }

  const peak = Math.max(...columns);
  const max = Math.max(peak, 0.0001);
  // Prefer an explicit favourite (1-based) when it points at a real,
  // in-range bar; otherwise fall back to the tallest bar.
  const favIdx =
    favoriteColumn != null &&
    favoriteColumn >= 1 &&
    favoriteColumn <= columns.length
      ? favoriteColumn - 1
      : columns.indexOf(peak);

  const favName = COLUMN_NAMES[favIdx] || `column ${favIdx + 1}`;

  return (
    <div>
      <div className={styles.bars}>
        {columns.map((v, i) => {
          const fav = i === favIdx;
          return (
            <div key={i} className={styles.col}>
              <span className={[styles.pct, fav && styles.favPct].filter(Boolean).join(" ")}>
                {Math.round(v * 100)}%
              </span>
              <div
                className={[styles.bar, fav && styles.favBar].filter(Boolean).join(" ")}
                style={{ height: `${(v / max) * 70 + 6}px` }}
              />
            </div>
          );
        })}
      </div>
      <div className={styles.labels}>
        {[1, 2, 3, 4, 5, 6, 7].map((n) => (
          <span key={n}>col {n}</span>
        ))}
      </div>
      <p className={styles.note}>
        You favor the <span className={styles.accent}>{favName}</span> in your opening. Players
        who lose to you rarely punish this — but Insane AI does.
      </p>
    </div>
  );
}
