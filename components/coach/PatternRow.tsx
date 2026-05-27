"use client";

/**
 * A single "Patterns spotted" callout (coach.jsx PatternRow): a tinted icon
 * square + title + sub. Tone maps to success / danger / coral.
 */

import { Icon, type IconName } from "@/components/ui";
import type { PatternTone } from "@/lib/coach/llm";
import styles from "./PatternRow.module.css";

export interface PatternRowProps {
  tone: PatternTone;
  title: string;
  sub: string;
}

const TONE_COLOR: Record<PatternTone, string> = {
  success: "var(--success)",
  danger: "var(--danger)",
  coral: "var(--coral)",
};

const TONE_ICON: Record<PatternTone, IconName> = {
  success: "check",
  danger: "x",
  coral: "spark",
};

export function PatternRow({ tone, title, sub }: PatternRowProps) {
  const color = TONE_COLOR[tone];
  return (
    <div className={styles.row}>
      <span
        className={styles.iconBox}
        style={{
          color,
          background: `color-mix(in oklch, ${color} 12%, transparent)`,
        }}
      >
        <Icon name={TONE_ICON[tone]} size={12} stroke={2.2} />
      </span>
      <span className={styles.body}>
        <span className={styles.title}>{title}</span>
        <span className={styles.sub}>{sub}</span>
      </span>
    </div>
  );
}
