import { avatarPalette, initials } from "@/lib/tokens";

export interface AvatarProps {
  name?: string;
  size?: number;
  /** Color of an outer ring (e.g. coral for the active player). */
  ring?: string;
  src?: string;
  className?: string;
}

/**
 * Initials avatar with a deterministic color from the name's hash (tokens.jsx).
 * Falls back to initials when no image `src` is provided.
 */
export function Avatar({ name = "Player", size = 36, ring, src, className }: AvatarProps) {
  const [bg, fg] = avatarPalette(name);
  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: src ? undefined : bg,
        color: fg,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "var(--font-sans)",
        fontWeight: 600,
        fontSize: size * 0.4,
        letterSpacing: -0.3,
        overflow: "hidden",
        flexShrink: 0,
        boxShadow: ring ? `0 0 0 2px var(--bg), 0 0 0 4px ${ring}` : undefined,
      }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          width={size}
          height={size}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        initials(name)
      )}
    </div>
  );
}
