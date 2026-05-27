"use client";

import { Icon } from "@/components/ui";
import { useSound } from "@/lib/sound";

export interface SoundToggleProps {
  size?: number;
  className?: string;
}

/**
 * Mute / unmute icon button for Drop4's synthesized sound cues.
 *
 * Reads + persists the mute flag via `useSound()` (localStorage `drop4:muted`)
 * and plays a soft click when un-muting so the user immediately hears that
 * audio is back on. Styled inline with design tokens to match `ThemeToggle`.
 */
export function SoundToggle({ size = 34, className }: SoundToggleProps) {
  const { muted, toggle, playClick } = useSound();

  const handle = () => {
    const wasMuted = muted;
    toggle();
    // If we just turned sound ON, give immediate feedback.
    if (wasMuted) playClick();
  };

  return (
    <button
      type="button"
      aria-label={muted ? "Unmute sound" : "Mute sound"}
      aria-pressed={muted}
      onClick={handle}
      className={className}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: muted ? "var(--text-mute)" : "var(--text)",
        cursor: "pointer",
        boxShadow: "var(--shadow-sm)",
        transition: "background 0.13s var(--ease), color 0.13s var(--ease)",
      }}
    >
      <Icon name={muted ? "mute" : "volume"} size={16} />
    </button>
  );
}
