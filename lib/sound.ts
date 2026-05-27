/**
 * Drop4 sound design — a tiny synthesized WebAudio module.
 *
 * No asset files: every cue is built from oscillators + gain envelopes, so the
 * whole thing is a few hundred bytes and never blocks on a network fetch.
 *
 * Cues:
 *   playDrop()   — a short, woody "tock" for a disc landing.
 *   playWin()    — a rising three-note arpeggio for a victory.
 *   playThreat() — a tense two-tone alert when a four is threatened.
 *   playClick()  — a soft UI tick for buttons / column selection.
 *
 * SSR-safe: there is no AudioContext until the first cue fires (which is, by
 * definition, inside a user gesture — required by browser autoplay policy).
 * A persisted mute flag lives in localStorage under `drop4:muted`.
 *
 * Framework-light on purpose: the play* functions are plain calls so the engine
 * / board integration can fire them without React. `useSound()` is a thin hook
 * for components that want the mute state to re-render (e.g. the toggle).
 */

const MUTE_KEY = "drop4:muted";

// ── Persisted mute flag ──────────────────────────────────────────────

/** Read the persisted mute flag (defaults to unmuted). SSR-safe. */
export function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

/** A subscriber notified whenever the mute flag changes (within this tab). */
type MuteListener = (muted: boolean) => void;
const muteListeners = new Set<MuteListener>();

/** Persist + broadcast the mute flag. */
export function setMuted(muted: boolean): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
    } catch {
      // Storage unavailable (private mode / quota) — keep going in-memory.
    }
  }
  for (const fn of muteListeners) fn(muted);
}

/** Flip the mute flag and return the new value. */
export function toggleMuted(): boolean {
  const next = !isMuted();
  setMuted(next);
  return next;
}

/** Subscribe to mute changes; returns an unsubscribe fn. */
export function subscribeMuted(fn: MuteListener): () => void {
  muteListeners.add(fn);
  return () => muteListeners.delete(fn);
}

// ── Lazy AudioContext ────────────────────────────────────────────────

type AudioCtor = typeof AudioContext;

let ctx: AudioContext | null = null;

/** Get (or lazily create) the shared AudioContext. Returns null off the main thread. */
function audioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (ctx) return ctx;
  const Ctor: AudioCtor | undefined =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx = new Ctor();
  } catch {
    return null;
  }
  return ctx;
}

/**
 * Resolve a usable, running context for playback. Returns null when muted, on
 * the server, or when WebAudio is unavailable. Resumes a suspended context
 * (some browsers start it suspended until the first gesture).
 */
function liveContext(): AudioContext | null {
  if (isMuted()) return null;
  const ac = audioContext();
  if (!ac) return null;
  if (ac.state === "suspended") {
    // Fire-and-forget: resume happens within the triggering gesture.
    void ac.resume().catch(() => {});
  }
  return ac;
}

// ── Synthesis primitives ─────────────────────────────────────────────

interface ToneOptions {
  freq: number;
  /** seconds from now until the note starts. */
  delay?: number;
  /** note length in seconds. */
  dur?: number;
  type?: OscillatorType;
  /** peak gain (0..1). */
  gain?: number;
  /** linear glide to this frequency over the note (portamento). */
  glideTo?: number;
}

/** Schedule a single enveloped oscillator note on `ac`. */
function tone(ac: AudioContext, dest: AudioNode, opts: ToneOptions): void {
  const {
    freq,
    delay = 0,
    dur = 0.12,
    type = "sine",
    gain = 0.18,
    glideTo,
  } = opts;
  const t0 = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (glideTo !== undefined) {
    osc.frequency.linearRampToValueAtTime(glideTo, t0 + dur);
  }
  // Fast attack, exponential-ish decay via a ramp to ~0.
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + Math.min(0.012, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(dest);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

/** Shared master gain so all cues sit at a comfortable, consistent level. */
let master: GainNode | null = null;
function masterBus(ac: AudioContext): GainNode {
  if (master && (master.context as AudioContext) === ac) return master;
  master = ac.createGain();
  master.gain.value = 0.6;
  master.connect(ac.destination);
  return master;
}

// ── Public cues ──────────────────────────────────────────────────────

/** A disc lands: a short, slightly-detuned woody tock. */
export function playDrop(): void {
  const ac = liveContext();
  if (!ac) return;
  const bus = masterBus(ac);
  tone(ac, bus, { freq: 196, glideTo: 120, dur: 0.13, type: "triangle", gain: 0.22 });
  tone(ac, bus, { freq: 392, dur: 0.05, type: "sine", gain: 0.08 });
}

/** Victory: a bright rising arpeggio (C5–E5–G5). */
export function playWin(): void {
  const ac = liveContext();
  if (!ac) return;
  const bus = masterBus(ac);
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    tone(ac, bus, {
      freq: f,
      delay: i * 0.085,
      dur: i === notes.length - 1 ? 0.42 : 0.18,
      type: "triangle",
      gain: 0.2,
    });
  });
}

/** Threat alert: a tense two-tone (minor second) ping. */
export function playThreat(): void {
  const ac = liveContext();
  if (!ac) return;
  const bus = masterBus(ac);
  tone(ac, bus, { freq: 660, dur: 0.1, type: "square", gain: 0.1 });
  tone(ac, bus, { freq: 700, delay: 0.11, dur: 0.14, type: "square", gain: 0.1 });
}

/** Soft UI tick for buttons and column hovers/selection. */
export function playClick(): void {
  const ac = liveContext();
  if (!ac) return;
  const bus = masterBus(ac);
  tone(ac, bus, { freq: 880, dur: 0.04, type: "sine", gain: 0.07 });
}

/** Map of every named cue (handy for the hook + integration wiring). */
export const sound = {
  drop: playDrop,
  win: playWin,
  threat: playThreat,
  click: playClick,
} as const;

export type SoundName = keyof typeof sound;

// ── React hook ───────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";

export interface UseSound {
  muted: boolean;
  toggle: () => void;
  setMuted: (muted: boolean) => void;
  play: (name: SoundName) => void;
  playDrop: () => void;
  playWin: () => void;
  playThreat: () => void;
  playClick: () => void;
}

/**
 * Subscribe a component to the mute flag and expose the cue functions.
 * Reads the persisted flag after mount (avoids an SSR/client mismatch — the
 * first render always reports `false`).
 */
export function useSound(): UseSound {
  const [muted, setMutedState] = useState(false);

  useEffect(() => {
    setMutedState(isMuted());
    return subscribeMuted(setMutedState);
  }, []);

  const setMutedCb = useCallback((next: boolean) => setMuted(next), []);
  const toggle = useCallback(() => {
    setMuted(!isMuted());
  }, []);
  const play = useCallback((name: SoundName) => sound[name](), []);

  return {
    muted,
    toggle,
    setMuted: setMutedCb,
    play,
    playDrop,
    playWin,
    playThreat,
    playClick,
  };
}
