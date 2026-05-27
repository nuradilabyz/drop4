"use client";

import type { Difficulty } from "@/engine/types";
import styles from "./play.module.css";

export const DIFFICULTIES: { value: Difficulty; label: string }[] = [
  { value: "easy", label: "Easy" },
  { value: "normal", label: "Normal" },
  { value: "hard", label: "Hard" },
  { value: "insane", label: "Insane" },
];

export interface DifficultySelectorProps {
  value: Difficulty;
  onChange: (d: Difficulty) => void;
}

function DifficultyBars({ level, active }: { level: number; active: boolean }) {
  return (
    <span className={styles.bars} aria-hidden="true">
      {[1, 2, 3, 4].map((i) => (
        <span
          key={i}
          className={styles.bar}
          data-on={i <= level}
          data-active={active}
          style={{ height: 3 + i * 2 }}
        />
      ))}
    </span>
  );
}

export function DifficultySelector({ value, onChange }: DifficultySelectorProps) {
  const activeLabel = DIFFICULTIES.find((d) => d.value === value)?.label;
  return (
    <div className={styles.diff}>
      <div className={styles.diffHead}>
        <span>Difficulty</span>
        <span className={styles.diffActive}>{activeLabel}</span>
      </div>
      <div className={styles.diffGrid} role="radiogroup" aria-label="AI difficulty">
        {DIFFICULTIES.map((d, i) => {
          const on = d.value === value;
          return (
            <button
              key={d.value}
              type="button"
              role="radio"
              aria-checked={on}
              className={styles.diffBtn}
              data-active={on}
              onClick={() => onChange(d.value)}
            >
              <DifficultyBars level={i + 1} active={on} />
              <span>{d.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
