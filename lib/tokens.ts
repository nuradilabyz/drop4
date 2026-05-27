/**
 * Design-token constants for JS-driven sizing and color lookups.
 * The colors themselves live as CSS custom properties in app/globals.css; this
 * module mirrors the scales the design uses (tokens.jsx) for pixel math (e.g. the
 * Board) and exposes typed names so components don't stringly-type var() refs.
 */

/** Spacing scale (px): 4, 8, 12, 16, 22, 28, 40, 56. */
export const SPACE = [4, 8, 12, 16, 22, 28, 40, 56] as const;

/** Border-radius scale (px) keyed by role. */
export const RADIUS = {
  chip: 8,
  tile: 10,
  swatch: 12,
  block: 14,
  card: 18,
  mode: 22,
  board: 24,
} as const;

/** Shared easing curve from the design. */
export const EASE = "cubic-bezier(0.2, 0.7, 0.3, 1)";

/** Color token names available as `var(--<name>)`. */
export type ColorToken =
  | "bg"
  | "surface"
  | "surface-2"
  | "surface-3"
  | "border"
  | "border-strong"
  | "text"
  | "text-dim"
  | "text-mute"
  | "coral"
  | "coral-soft"
  | "aqua"
  | "aqua-soft"
  | "gold"
  | "danger"
  | "success"
  | "on-coral";

/** Resolve a color token to a CSS `var(...)` reference. */
export const cssVar = (token: ColorToken): string => `var(--${token})`;

/**
 * Avatar background/foreground pairs (ported verbatim from tokens.jsx).
 * Initials avatars pick a pair by hashing the name.
 */
export const AVATAR_COLORS: ReadonlyArray<readonly [bg: string, fg: string]> = [
  ["#e8a86b", "#3b2517"],
  ["#7fb5a3", "#1a2a26"],
  ["#c08fb8", "#2a1828"],
  ["#a8b069", "#22240e"],
  ["#7ba5d4", "#15212e"],
  ["#d49a7a", "#2e1812"],
  ["#9d8fc3", "#1c1726"],
  ["#b8a25e", "#241e0a"],
];

/** Stable hash → avatar palette index (matches the design's algorithm). */
export function avatarPalette(name: string): readonly [string, string] {
  const hash = name
    .split("")
    .reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 0);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

/** Two-letter initials from a name (matches the design). */
export function initials(name: string): string {
  return name
    .split(/[ -]/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export type Theme = "light" | "dark";
export const THEME_STORAGE_KEY = "drop4-theme";
