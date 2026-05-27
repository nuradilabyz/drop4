"use client";

import { useId, useMemo, useState } from "react";
import { Chip } from "@/components/ui";
import { getMockEloHistory, type EloRange } from "@/lib/mockData";
import styles from "./EloChart.module.css";

export interface EloChartProps {
  username: string;
  /** Initial range; defaults to 30d. */
  defaultRange?: EloRange;
}

const RANGES: { key: EloRange; label: string }[] = [
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "all", label: "All" },
];

const W = 720;
const H = 180;

/** Round y-grid bounds so the line never clips the top/bottom. */
function bounds(values: number[]): { min: number; max: number; grid: number[] } {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const min = Math.floor((lo - 20) / 50) * 50;
  const max = Math.ceil((hi + 20) / 50) * 50;
  const grid: number[] = [];
  for (let g = min + 50; g < max; g += 50) grid.push(g);
  return { min, max, grid };
}

/**
 * SVG ELO line chart with a gradient area fill (ported from profile.jsx).
 * Self-contained: owns the 7d/30d/All toggle and pulls each window from the
 * mock data seam. Colours come from tokens via the SVG `style` attribute.
 */
export function EloChart({ username, defaultRange = "30d" }: EloChartProps) {
  const [range, setRange] = useState<EloRange>(defaultRange);
  const gradId = useId();
  const series = useMemo(() => getMockEloHistory(username, range), [username, range]);

  const { min, max, grid, path, area, pts, xLabels } = useMemo(() => {
    const data = series.values;
    const { min, max, grid } = bounds(data);
    const span = max - min || 1;
    const pts = data.map<[number, number]>((v, i) => [
      data.length === 1 ? W / 2 : (i / (data.length - 1)) * W,
      H - ((v - min) / span) * H,
    ]);
    const path = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const area = `${path} L${W} ${H} L0 ${H} Z`;

    // Up to 5 evenly spaced day-ago labels.
    const n = data.length;
    const idxs = Array.from(new Set([0, Math.round(n * 0.25), Math.round(n * 0.5), Math.round(n * 0.75), n - 1]))
      .filter((i) => i >= 0 && i < n)
      .sort((a, b) => a - b);
    const xLabels = idxs.map((i) => ({ x: pts[i][0], label: `${n - i}d` }));
    return { min, max, grid, path, area, pts, xLabels };
  }, [series]);

  const last = pts[pts.length - 1];

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <div className={styles.title}>ELO over time</div>
          <div className={styles.sub}>{series.label}</div>
        </div>
        <div className={styles.toggle} role="tablist" aria-label="Chart range">
          {RANGES.map((r) => (
            <button
              key={r.key}
              type="button"
              role="tab"
              aria-selected={range === r.key}
              className={styles.chipBtn}
              onClick={() => setRange(r.key)}
            >
              <Chip tone={range === r.key ? "neutral" : "outline"} size="sm">
                {r.label}
              </Chip>
            </button>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H + 24}`} className={styles.svg} role="img" aria-label={`ELO ${series.label}`}>
        {grid.map((g) => {
          const y = H - ((g - min) / (max - min)) * H;
          return (
            <g key={g}>
              <line x1="0" x2={W} y1={y} y2={y} className={styles.gridLine} strokeDasharray="3 4" />
              <text x="4" y={y - 4} className={styles.axis}>
                {g}
              </text>
            </g>
          );
        })}
        <defs>
          <linearGradient id={gradId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" className={styles.fillTop} />
            <stop offset="100%" className={styles.fillBottom} />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={path} className={styles.line} fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={last[0]} cy={last[1]} r="4" className={styles.endDot} />
        <circle cx={last[0]} cy={last[1]} r="8" className={styles.endHalo} />
        {xLabels.map((l, i) => (
          <text key={i} x={l.x} y={H + 16} className={styles.axis} textAnchor="middle">
            {l.label}
          </text>
        ))}
      </svg>
    </div>
  );
}
