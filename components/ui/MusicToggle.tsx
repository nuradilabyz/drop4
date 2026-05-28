"use client";

/**
 * Round ghost button that toggles background music. Mirrors ThemeToggle's
 * shape + size so the Nav looks balanced when both sit next to each other.
 * On mount, restores the saved preference and resumes playback if the user
 * had it on last time — but only because the prior `enable()` call counts
 * as a same-origin user gesture; cold visits start silent.
 */

import { useEffect, useState } from "react";
import { musicPlayer } from "@/lib/audio/musicPlayer";
import { Icon } from "./Icon";

export interface MusicToggleProps {
  size?: number;
  className?: string;
  /** Public path of the audio file to loop. */
  src: string;
}

export function MusicToggle({ size = 34, className, src }: MusicToggleProps) {
  // Start as `null` until we read localStorage — avoids a flicker between
  // server "off" and client "on".
  const [enabled, setEnabled] = useState<boolean | null>(null);

  useEffect(() => {
    const stored = musicPlayer.isPreferredOn();
    setEnabled(stored);
    if (stored) musicPlayer.enable(src);
  }, [src]);

  function toggle() {
    if (enabled) {
      musicPlayer.disable();
      setEnabled(false);
    } else {
      musicPlayer.enable(src);
      setEnabled(true);
    }
  }

  const showOn = enabled === true;

  return (
    <button
      type="button"
      aria-label={showOn ? "Mute background music" : "Play background music"}
      title={showOn ? "Music on — click to mute" : "Music off — click to play"}
      onClick={toggle}
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
        color: showOn ? "var(--coral)" : "var(--text)",
        cursor: "pointer",
        boxShadow: "var(--shadow-sm)",
        transition: "background 0.13s var(--ease), color 0.13s var(--ease)",
      }}
    >
      <Icon name={showOn ? "volume" : "mute"} size={16} />
    </button>
  );
}
