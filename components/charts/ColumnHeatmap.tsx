import styles from "./ColumnHeatmap.module.css";

export interface ColumnHeatmapProps {
  /** Opening preference as a fraction per column (7 entries). */
  columns: number[];
}

/**
 * 7-column opening-preference bars (ported from profile.jsx). The favourite
 * column (the max) is painted coral; the rest are recessed surface bars.
 */
export function ColumnHeatmap({ columns }: ColumnHeatmapProps) {
  const max = Math.max(...columns, 0.0001);
  const favIdx = columns.indexOf(Math.max(...columns));

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
        You favor the <span className={styles.accent}>center column</span> in your opening. Players
        who lose to you rarely punish this — but Insane AI does.
      </p>
    </div>
  );
}
