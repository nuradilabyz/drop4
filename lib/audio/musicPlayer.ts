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
 * interacted with the page. We default the *preference* to ON (so a cold
 * visitor sees the toggle lit up once playback actually starts) but call
 * `audio.play()` defensively — if the browser rejects with NotAllowedError
 * we arm a one-shot listener for the first pointerdown / touchstart /
 * keydown anywhere on the page (except on the music toggle itself, which
 * has its own onClick to start playback). On that gesture we retry play
 * and notify subscribers, so the toggle UI flips to its "on" colour the
 * instant audio actually starts. The only way to stay silent is to
 * explicitly hit the mute toggle — that writes "off" to localStorage,
 * which is the one value that wins over default-on.
 *
 * The `isPlaying` + `subscribe` pair exists so the toggle component can
 * paint based on *actual playback*, not the persisted preference. Earlier
 * versions painted from preference and lied to the user: after a refresh
 * the icon read "on" while audio was actually waiting for a gesture.
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
];

/** Marker attribute the MusicToggle adds to its <button>. The auto-gesture
 *  listener skips clicks landing on this element so the toggle's own
 *  onClick handler stays in charge of starting playback for that click. */
const TOGGLE_ATTR = "data-music-toggle";

type PlayingListener = (playing: boolean) => void;

class MusicPlayer {
  private audio: HTMLAudioElement | null = null;
  private fadeRaf: number | null = null;
  /** Set while we're waiting for the first user gesture to start playback. */
  private gestureArmedSrc: string | null = null;
  private gestureHandler: ((e: Event) => void) | null = null;
  private listeners = new Set<PlayingListener>();

  /**
   * Should music be on for this visitor?
   *
   * Cold visits + anything other than the explicit "off" sentinel return
   * true. We only stay silent for users who actively muted (`disable()` →
   * `persist("off")`). This is what lets the page feel like it autoplays
   * — the first interaction starts the audio and the toggle paints lit up.
   */
  isPreferredOn(): boolean {
    if (typeof window === "undefined") return false;
    try {
      return window.localStorage.getItem(STORAGE_KEY) !== "off";
    } catch {
      // Storage disabled (Safari private mode etc.) — fall back to on; the
      // user can still mute for the session, just nothing persists.
      return true;
    }
  }

  /** True only when the underlying <audio> element is actively playing. */
  isPlaying(): boolean {
    return this.audio !== null && !this.audio.paused;
  }

  /** Subscribe to playback-state changes. Returns an unsubscribe fn. */
  subscribe(fn: PlayingListener): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
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
    this.persist("on");

    const playPromise = this.audio.play();
    if (playPromise && typeof playPromise.then === "function") {
      playPromise.then(
        () => {
          this.disarmGesture();
          this.fade(DEFAULT_VOLUME, FADE_IN_MS);
          this.notify();
        },
        () => {
          // Autoplay blocked — wait for a user gesture and try again.
          this.armGesture(src);
        },
      );
    } else {
      // Legacy sync path — assume success.
      this.fade(DEFAULT_VOLUME, FADE_IN_MS);
      this.notify();
    }
  }

  /** Fade out + pause. Idempotent. */
  disable(): void {
    this.persist("off");
    this.disarmGesture();
    if (!this.audio) return;
    this.fade(0, FADE_OUT_MS, () => {
      this.audio?.pause();
      this.notify();
    });
  }

  /**
   * After an autoplay rejection, listen for the first user gesture anywhere
   * on the page and retry `enable`. Capture-phase so we win against any
   * preventDefault/stopPropagation deeper in the tree. We skip clicks that
   * landed on the music toggle itself — its onClick handler is the proper
   * place to start playback for that click, and letting both fire would
   * race (gesture-handler starts music, then onClick reads "playing" and
   * mutes it again).
   */
  private armGesture(src: string): void {
    if (this.gestureArmedSrc === src) return; // already waiting
    this.disarmGesture();
    this.gestureArmedSrc = src;
    const handler = (e: Event) => {
      const target = e.target;
      if (
        target instanceof Element &&
        target.closest(`[${TOGGLE_ATTR}]`) !== null
      ) {
        // Toggle owns this click — bail and let it call enable() itself.
        return;
      }
      const saved = this.gestureArmedSrc;
      this.disarmGesture();
      // Respect a mute that happened between arming and the gesture.
      if (!this.isPreferredOn() || !saved) return;
      this.enable(saved);
    };
    this.gestureHandler = handler;
    for (const ev of GESTURE_EVENTS) {
      window.addEventListener(ev, handler, { capture: true });
    }
  }

  private disarmGesture(): void {
    if (!this.gestureHandler) {
      this.gestureArmedSrc = null;
      return;
    }
    for (const ev of GESTURE_EVENTS) {
      window.removeEventListener(ev, this.gestureHandler, { capture: true });
    }
    this.gestureHandler = null;
    this.gestureArmedSrc = null;
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
