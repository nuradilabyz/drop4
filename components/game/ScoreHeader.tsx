import styles from "./ScoreHeader.module.css";

export interface ScoreHeaderProps {
  leftLabel: string;
  leftScore: number;
  rightLabel: string;
  rightScore: number;
  /** Middle pill, e.g. "Game 3 of 5". Omit to hide. */
  series?: string;
}

export function ScoreHeader({
  leftLabel,
  leftScore,
  rightLabel,
  rightScore,
  series,
}: ScoreHeaderProps) {
  return (
    <div className={styles.wrap}>
      <div className={styles.side}>
        <div className={`${styles.score} ${styles.coral}`}>{leftScore}</div>
        <div className={styles.label}>{leftLabel}</div>
      </div>
      {series && <div className={styles.series}>{series}</div>}
      <div className={styles.side}>
        <div className={`${styles.score} ${styles.aqua}`}>{rightScore}</div>
        <div className={styles.label}>{rightLabel}</div>
      </div>
    </div>
  );
}
