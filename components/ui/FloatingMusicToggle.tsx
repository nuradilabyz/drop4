"use client";

/**
 * Mobile-only floating control cluster. The Nav (where the desktop music +
 * theme toggles live) is hidden under 640px, so on a phone the user has no
 * way to switch music OR theme. This component is `display:none` on desktop
 * and renders a fixed-position stack above the MobileTabBar on mobile,
 * mirroring `FloatingMusicToggle.module.css`'s breakpoint gating.
 *
 * Both controls reuse the existing primitives: `<MusicToggle/>` drives the
 * `musicPlayer` singleton, and `<ThemeToggle standalone/>` reuses the theme
 * logic in `lib/theme.tsx`. `standalone` is required because this cluster is
 * mounted in app/layout.tsx *outside* `<ThemeProvider>`, so the context form
 * would throw; the standalone controller shares the same DOM/storage source
 * of truth, so it stays in lock-step with the desktop Nav toggle.
 */

import { ThemeToggle } from "./ThemeToggle";
import { MusicToggle } from "./MusicToggle";
import styles from "./FloatingMusicToggle.module.css";

const LOFI_TRACK = "/audio/lofi.mp3";

export function FloatingMusicToggle() {
  return (
    <div className={styles.wrap}>
      <ThemeToggle size={44} standalone />
      <MusicToggle size={44} src={LOFI_TRACK} />
    </div>
  );
}
