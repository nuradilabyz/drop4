/**
 * Singleton background-music player. Wraps one HTMLAudioElement and exposes
 * `enable` / `disable` with smooth fade in/out + localStorage persistence,
 * so the user's mute preference carries across navigations + reloads.
 *
 * Why a class instead of a hook: a hook would tear down + recreate the
 * <audio> element on every route change, snapping the music off whenever
 * the user navigates from / to /play. A module-level singleton survives
 * routing and only stops when the user explicitly toggles.
 *
 * Autoplay note: browsers block audio playback until the user has
 * interacted with the page. We therefore never call `.play()` until the
 * user clicks the toggle button — once they've explicitly opted in, the
 * preference sticks for future sessions on this device.
 */

const STORAGE_KEY = "drop4-music";
const DEFAULT_VOLUME = 0.22;
const FADE_IN_MS = 1400;
const FADE_OUT_MS = 700;

class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private fadeRaf: number | null = null;

  /** Was music ON the last time the user expressed a preference? */
  isPreferredOn(): boolean {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) === "on";
    } catch {
      return false;
    }
  }

  /** Begin playback (creating the <audio> on first call). Idempotent. */
  enable(src: string): void {
    if (typeof window === "undefined") return;
    if (!this.audio) {
      this.audio = new Audio(src);
      this.audio.loop = true;
      this.audio.volume = 0;
      this.audio.preload = "auto";
    }
    void this.audio.play().catch(() => {
      // Autoplay policy or network — silently fail, user can click again.
    });
    this.fade(DEFAULT_VOLUME, FADE_IN_MS);
    this.persist("on");
  }

  /** Fade out + pause. Idempotent. */
  disable(): void {
    this.persist("off");
    if (!this.audio) return;
    this.fade(0, FADE_OUT_MS, () => {
      this.audio?.pause();
    });
  }

  private fade(target: number, ms: number, done?: () => void) {
    const a = this.audio;
    if (!a) return;
    if (this.fadeRaf !== null) cancelAnimationFrame(this.fadeRaf);
    const start = a.volume;
    const t0 = performance.now();
    const tick = () => {
      if (!this.audio) return;
      const t = Math.min(1, (performance.now() - t0) / ms);
      this.audio.volume = start + (target - start) * t;
      if (t < 1) {
        this.fadeRaf = requestAnimationFrame(tick);
      } else {
        this.fadeRaf = null;
        done?.();
      }
    };
    this.fadeRaf = requestAnimationFrame(tick);
  }

  private persist(value: "on" | "off") {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, value);
    } catch {
      /* storage disabled / private mode — runtime state still works */
    }
  }
}

export const musicPlayer = new MusicPlayer();
