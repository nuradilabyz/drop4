import type { ReactNode } from "react";
import styles from "./StatTile.module.css";

export interface StatTileProps {
  label: ReactNode;
  value: ReactNode;
  sub?: ReactNode;
  /** Color the value (e.g. var(--coral), var(--success)). */
  accent?: string;
  className?: string;
}

export function StatTile({ label, value, sub, accent, className }: StatTileProps) {
  return (
    <div className={[styles.tile, className].filter(Boolean).join(" ")}>
      <span className={styles.label}>{label}</span>
      <span className={styles.value} style={accent ? { color: accent } : undefined}>
        {value}
      </span>
      {sub && <span className={styles.sub}>{sub}</span>}
    </div>
  );
}
