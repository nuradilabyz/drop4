"use client";

/**
 * Mobile-only floating wrapper around `<MusicToggle/>`. The Nav (where the
 * desktop toggle lives next to ThemeToggle) is hidden under 640px, so on
 * a phone the user has no way to switch music on. This component is
 * `display:none` on desktop and renders a fixed-position button above
 * the MobileTabBar on mobile. The underlying `musicPlayer` is a module
 * singleton, so both toggles drive the same playback state.
 */

import { MusicToggle } from "./MusicToggle";
import styles from "./FloatingMusicToggle.module.css";

const LOFI_TRACK = "/audio/lofi.mp3";

export function FloatingMusicToggle() {
  return (
    <div className={styles.wrap}>
      <MusicToggle size={44} src={LOFI_TRACK} />
    </div>
  );
}
