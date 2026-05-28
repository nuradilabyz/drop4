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
 * Autoplay note: every modern browser blocks `play()` on unmuted audio
 * before the first user interaction. They DO allow muted autoplay,
 * however — and we exploit that to get as close to real autoplay as a
 * web page legally can. On a default-on visit we create the audio
 * element with muted=true, call play() (the browser allows it because
 * it's silent), and arm a one-shot listener for the first user gesture
 * (pointerdown/touchstart/keydown/wheel/scroll anywhere on the page,
 * except on the music toggle itself). On that gesture we just lift the
 * mute — audio has been quietly running the whole time, so it becomes
 * audible *instantly* from wherever the loop happens to be, with a soft
 * fade-in. From the user's seat it feels like the page started playing
 * the moment they touched the screen. The only path back to silent is
 * an explicit mute click, which persists "off" and wins over default-on
 * forever.
 *
 * `isPlaying` returns true only when audio is **actually audible**
 * (paused === false AND muted === false). The toggle UI mirrors that so
 * the icon paints lit up only when the user can actually hear something.
 */

const STORAGE_KEY = "drop4-music";
// Background bed — kept low on purpose so the lofi sits *under* gameplay
// cues (drop/win) and never competes with conversation. Bumping this above
// ~0.15 makes the piano feel forward instead of ambient.
const DEFAULT_VOLUME = 0.1;
const FADE_IN_MS = 1400;
const FADE_OUT_MS = 700;

const GESTURE_EVENTS: ReadonlyArray<keyof WindowEventMap> = [
  "pointerdown",
  "touchstart",
  "keydown",
  "wheel",
  "scroll",
];

/** Marker attribute the MusicToggle adds to its <button>. The auto-gesture
 *  listener skips clicks landing on this element so the toggle's own
 *  onClick handler stays in charge of the unmute/start action. */
const TOGGLE_ATTR = "data-music-toggle";

type PlayingListener = (playing: boolean) => void;

class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private fadeRaf: number | null = null;
  private gestureHandler: ((e: Event) => void) | null = null;
  private listeners = new Set<PlayingListener>();
  /** Last src handed to enable(); lets visibility/recovery paths re-arm
   *  even after the audio element was torn down by a rejected play(). */
  private lastSrc: string | null = null;
  /** Guard so we only ever attach one visibilitychange listener. */
  private visibilityHandler: (() => void) | null = null;

  isPreferredOn(): boolean {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
      return true;
    }
  }

  /** True only when audio is actually audible — playing AND not muted. */
  isPlaying(): boolean {
    return this.audio !== null && !this.audio.paused && !this.audio.muted;
  }

  subscribe(fn: PlayingListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  /**
   * Start (or kick-start audible) playback. Idempotent. Two cases:
   *
   * 1. First call on a cold page: create the <audio>, mark it muted (so
   *    autoplay policy lets us start), play it silently, and arm a
   *    one-shot listener to unmute on the first user gesture.
   * 2. Subsequent call (toggle click, or the gesture handler firing):
   *    lift the mute / unpause / fade in to default volume.
   *
   * Either path persists the preference as "on".
   */
  enable(src: string): void {
    if (typeof window === "undefined") return;
    this.persist("on");
    this.lastSrc = src;
    this.armVisibilityRecovery();

    if (!this.audio) {
      const a = new Audio(src);
      a.loop = true;
      a.preload = "auto";
      a.muted = true; // Muted autoplay is permitted everywhere.
      // iOS Safari refuses inline playback (and silently fails play())
      // without this; it also keeps audio off the fullscreen player.
      a.setAttribute("playsinline", "");
      a.volume = DEFAULT_VOLUME;
      this.audio = a;

      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(
          () => {
            // Silently playing. Wait for a gesture to unmute.
            this.armUnmute();
            this.notify(); // isPlaying() === false (still muted)
          },
          () => {
            // Even muted autoplay was rejected (extremely rare). Fall back
            // to the older "wait for gesture then play" model.
            this.audio = null;
            this.armColdStart(src);
          },
        );
      } else {
        // Sync code path — assume success.
        this.armUnmute();
        this.notify();
      }
      return;
    }

    // Audio already exists. This call comes from the toggle, the gesture
    // handler, or a re-render. Resume + unmute + fade in.
    this.unmuteAndPlay();
  }

  /** Fade out + pause. Idempotent. Writes preference "off". */
  disable(): void {
    this.persist("off");
    this.disarmGesture();
    if (!this.audio) return;
    this.fade(0, FADE_OUT_MS, () => {
      this.audio?.pause();
      this.notify();
    });
  }

  /** Apply unmute and/or resume on an existing audio element. */
  private unmuteAndPlay(): void {
    const a = this.audio;
    if (!a) return;
    this.disarmGesture();
    const wasMuted = a.muted;
    const wasPaused = a.paused;
    if (wasMuted) a.muted = false;

    if (wasPaused) {
      a.volume = 0;
      const p = a.play();
      if (p && typeof p.then === "function") {
        p.then(
          () => {
            this.fade(DEFAULT_VOLUME, FADE_IN_MS);
            this.notify();
          },
          () => {
            // Lost the gesture window — re-arm the cold-start path.
            this.armColdStart(a.src);
          },
        );
      } else {
        this.fade(DEFAULT_VOLUME, FADE_IN_MS);
        this.notify();
      }
    } else if (wasMuted) {
      // Already playing silently — fade in from zero on top of the audible
      // signal so the lofi swells in instead of snapping to full bed.
      a.volume = 0;
      this.fade(DEFAULT_VOLUME, FADE_IN_MS);
      this.notify();
    }
  }

  /** First-gesture listener used when we're already playing-but-muted. */
  private armUnmute(): void {
    this.disarmGesture();
    const handler = (e: Event) => {
      if (this.isOnToggle(e)) return; // toggle's onClick handles it
      if (!this.isPreferredOn()) {
        this.disarmGesture();
        return;
      }
      this.unmuteAndPlay();
    };
    this.gestureHandler = handler;
    for (const ev of GESTURE_EVENTS) {
      window.addEventListener(ev, handler, { capture: true, passive: true });
    }
  }

  /** Fallback for the (very rare) case where even muted autoplay failed —
   *  we never created the audio element; recreate it on first gesture. */
  private armColdStart(src: string): void {
    this.disarmGesture();
    const handler = (e: Event) => {
      if (this.isOnToggle(e)) return;
      if (!this.isPreferredOn()) {
        this.disarmGesture();
        return;
      }
      this.disarmGesture();
      this.enable(src);
    };
    this.gestureHandler = handler;
    for (const ev of GESTURE_EVENTS) {
      window.addEventListener(ev, handler, { capture: true, passive: true });
    }
  }

  private isOnToggle(e: Event): boolean {
    const t = e.target;
    return (
      t instanceof Element && t.closest(`[${TOGGLE_ATTR}]`) !== null
    );
  }

  private disarmGesture(): void {
    if (!this.gestureHandler) return;
    for (const ev of GESTURE_EVENTS) {
      window.removeEventListener(ev, this.gestureHandler, { capture: true });
    }
    this.gestureHandler = null;
  }

  /**
   * If the user wants music but it isn't currently audible (cold load,
   * blocked autoplay, lost gesture window, or a remount after navigation),
   * attempt to make it audible again. Safe to call repeatedly: when audio
   * already exists it unmutes/resumes; otherwise it recreates the element
   * via enable(). When the browser still blocks us, enable()/unmuteAndPlay()
   * re-arm the gesture path so the *next* interaction retries.
   */
  resumeIfPreferred(): void {
    if (typeof window === "undefined") return;
    if (!this.isPreferredOn()) return;
    if (this.isPlaying()) return;
    const src = this.lastSrc;
    if (!src) return;
    if (this.audio) {
      this.unmuteAndPlay();
    } else {
      this.enable(src);
    }
  }

  /**
   * Returning to a backgrounded tab can leave us muted/paused with the
   * gesture listener already consumed. Re-attempt playback when the tab
   * becomes visible. Idempotent — guarded so we never stack listeners.
   */
  private armVisibilityRecovery(): void {
    if (typeof document === "undefined") return;
    if (this.visibilityHandler) return;
    const handler = () => {
      if (document.visibilityState !== "visible") return;
      this.resumeIfPreferred();
    };
    this.visibilityHandler = handler;
    document.addEventListener("visibilitychange", handler);
  }

  private notify(): void {
    const playing = this.isPlaying();
    for (const fn of this.listeners) fn(playing);
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

export const MUSIC_TOGGLE_ATTR = TOGGLE_ATTR;
