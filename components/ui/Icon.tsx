/**
 * Stroke-based SVG icon set, ported verbatim from the design (tokens.jsx).
 * 16×16 viewBox, currentColor stroke. Add new glyphs to PATHS only.
 */

export const ICON_PATHS = {
  arrow: "M3 8h10M9 4l4 4-4 4",
  play: "M5 3l8 5-8 5z",
  plus: "M8 3v10M3 8h10",
  bolt: "M9 1L3 9h4l-1 6 6-8H8z",
  crown: "M2 12l1-7 3 3 2-5 2 5 3-3 1 7z",
  lock: "M4 7V5a3 3 0 016 0v2M3 7h8v6H3z",
  chart: "M2 13V3M2 13h11M5 10v2M8 7v5M11 5v7",
  user: "M8 8a3 3 0 100-6 3 3 0 000 6zM2 14c1-3 3.5-4 6-4s5 1 6 4",
  link: "M6 10l4-4M5 11l-1 1a2.8 2.8 0 01-4-4l2-2a2.8 2.8 0 014 0M11 5l1-1a2.8 2.8 0 014 0 2.8 2.8 0 010 4l-2 2a2.8 2.8 0 01-4 0",
  cup: "M4 3h8v3a3 3 0 11-6 0M4 3H2a1 1 0 000 2h2M12 3h2a1 1 0 010 2h-2M6 13h4M8 9v4",
  check: "M2 8l4 4 8-9",
  x: "M3 3l10 10M13 3L3 13",
  spark: "M8 2v3M8 11v3M2 8h3M11 8h3M4 4l2 2M10 10l2 2M12 4l-2 2M4 12l2-2",
  flame: "M8 1c1 3 4 4 4 8a4 4 0 11-8 0c0-2 1-3 2-4 0 2 1 3 2 3-1-2 0-5 0-7z",
  cpu: "M5 2v2M11 2v2M5 12v2M11 12v2M2 5h2M2 11h2M12 5h2M12 11h2M3 3h10v10H3z M6 6h4v4H6z",
  eye: "M1 8s2.5-5 7-5 7 5 7 5-2.5 5-7 5S1 8 1 8zM8 10.5A2.5 2.5 0 108 5.5a2.5 2.5 0 000 5z",
  share:
    "M5 8l6-4M5 8l6 4M11 4a2 2 0 100-2 2 2 0 000 2zM11 14a2 2 0 100-2 2 2 0 000 2zM5 10a2 2 0 100-2 2 2 0 000 2z",
  copy: "M5 5V3a1 1 0 011-1h7a1 1 0 011 1v7a1 1 0 01-1 1h-2M2 5h7a1 1 0 011 1v7a1 1 0 01-1 1H3a1 1 0 01-1-1V6a1 1 0 011-1z",
  settings:
    "M8 5a3 3 0 100 6 3 3 0 000-6zM8 1v2M8 13v2M3 3l1.5 1.5M11.5 11.5L13 13M1 8h2M13 8h2M3 13l1.5-1.5M11.5 4.5L13 3",
  flag: "M3 14V2M3 3h9l-2 3 2 3H3",
  chevR: "M6 3l5 5-5 5",
  chevL: "M10 3l-5 5 5 5",
  chevD: "M3 6l5 5 5-5",
  target:
    "M8 8m-7 0a7 7 0 1014 0 7 7 0 10-14 0M8 8m-3 0a3 3 0 106 0 3 3 0 10-6 0",
  sun: "M8 11a3 3 0 100-6 3 3 0 000 6zM8 1v2M8 13v2M3 3l1.5 1.5M11.5 11.5L13 13M1 8h2M13 8h2M3 13l1.5-1.5M11.5 4.5L13 3",
  moon: "M13 9.5A6 6 0 116.5 3a5 5 0 006.5 6.5z",
  globe: "M1 8h14M8 1c2.5 3 2.5 11 0 14M8 1c-2.5 3-2.5 11 0 14M8 1a7 7 0 100 14 7 7 0 000-14z",
  medal: "M5 2l3 6 3-6M5 14a4 4 0 108 0 4 4 0 10-8 0z M9 9.5L8 14 7 9.5",
  refresh: "M14 8a6 6 0 11-2-4.5M14 2v3.5h-3.5",
  // Added for nav / mobile tab bar.
  home: "M2 7l6-5 6 5M4 6.5V14h8V6.5",
  grid: "M2 2h5v5H2zM9 2h5v5H9zM2 9h5v5H2zM9 9h5v5H9z",
  pause: "M5 3v10M11 3v10",
  skipBack: "M12 3v10L5 8zM4 3v10",
  skipFwd: "M4 3v10l7-5zM12 3v10",
  volume: "M3 6v4h3l4 3V3L6 6zM12 6.5a2 2 0 010 3",
  mute: "M3 6v4h3l4 3V3L6 6zM11 6l3 4M14 6l-3 4",
} as const;

export type IconName = keyof typeof ICON_PATHS;

export interface IconProps {
  name: IconName;
  size?: number;
  stroke?: number;
  color?: string;
  className?: string;
}

export function Icon({
  name,
  size = 16,
  stroke = 1.6,
  color = "currentColor",
  className,
}: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke={color}
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "inline-block", flexShrink: 0 }}
      className={className}
      aria-hidden="true"
    >
      <path d={ICON_PATHS[name]} />
    </svg>
  );
}
