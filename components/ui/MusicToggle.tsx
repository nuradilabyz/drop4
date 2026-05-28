"use client";

/**
 * Round ghost button that toggles background music. Mirrors ThemeToggle's
 * shape + size so the Nav looks balanced when both sit next to each other.
 *
 * Visual state reflects *actual playback*, not the persisted preference:
 * after a page refresh the browser may block our auto-enable until the
 * user interacts, so painting from the preference alone would lie ("icon
 * says on, audio is silent"). Instead we subscribe to musicPlayer's
 * playback events and flip the icon the moment audio actually starts.
 *
 * The `data-music-toggle` attribute tells musicPlayer's gesture listener
 * to skip clicks on this button — its own onClick will call enable() and
 * that click is itself a valid gesture, so the browser will allow play.
 */

import { useEffect, useState } from "react";
import { musicPlayer, MUSIC_TOGGLE_ATTR } from "@/lib/audio/musicPlayer";
import { Icon } from "./Icon";

export interface MusicToggleProps {
  size?: number;
  className?: string;
  /** Public path of the audio file to loop. */
  src: string;
}

export function MusicToggle({ size = 34, className, src }: MusicToggleProps) {
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setPlaying(musicPlayer.isPlaying());
    const unsubscribe = musicPlayer.subscribe(setPlaying);
    if (musicPlayer.isPreferredOn() && !musicPlayer.isPlaying()) {
      // Default-on visitors: try to start now. If the browser blocks (cold
      // refresh, no gesture yet), musicPlayer arms a global listener and
      // playback kicks in on the first interaction elsewhere on the page.
      // Until that happens, `playing` stays false and the icon is muted —
      // honest signal that the audio isn't actually running yet.
      musicPlayer.enable(src);
    }
    return unsubscribe;
  }, [src]);

  function toggle() {
    if (musicPlayer.isPlaying()) {
      musicPlayer.disable();
    } else {
      // Either kick-starting an armed-but-blocked autoplay (toggle click
      // itself counts as the user gesture) or un-muting after an explicit
      // mute. Both flows go through enable().
      musicPlayer.enable(src);
    }
  }

  return (
    <button
      type="button"
      {...{ [MUSIC_TOGGLE_ATTR]: "" }}
      aria-label={playing ? "Mute background music" : "Play background music"}
      title={playing ? "Music on — click to mute" : "Music off — click to play"}
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
        color: playing ? "var(--coral)" : "var(--text)",
        cursor: "pointer",
        boxShadow: "var(--shadow-sm)",
        transition: "background 0.13s var(--ease), color 0.13s var(--ease)",
      }}
    >
      <Icon name={playing ? "volume" : "mute"} size={16} />
    </button>
  );
}
