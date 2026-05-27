export interface LogoProps {
  size?: number;
  /** Icon only, no wordmark. */
  mark?: boolean;
  className?: string;
}

/** Drop4 wordmark: graphite square with coral + aqua + neutral discs (tokens.jsx). */
export function Logo({ size = 22, mark = false, className }: LogoProps) {
  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        color: "var(--text)",
      }}
    >
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
        <rect x="1" y="1" width="22" height="22" rx="6" fill="var(--text)" />
        <circle cx="8.5" cy="15.5" r="2.6" fill="var(--coral)" />
        <circle cx="15.5" cy="15.5" r="2.6" fill="var(--aqua)" />
        <circle cx="12" cy="8.5" r="2.6" fill="var(--bg)" />
      </svg>
      {!mark && (
        <span style={{ fontWeight: 600, fontSize: size * 0.78, letterSpacing: -0.4 }}>
          Drop4
        </span>
      )}
    </span>
  );
}
