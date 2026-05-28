// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Models strict mobile-Chrome autoplay: play() is only permitted while a user
 * gesture is active (globalThis.__userActivated). Muted autoplay on a cold
 * page (no gesture) is rejected — the case that breaks "tap to play".
 */
class FakeAudio {
  muted = false;
  paused = true;
  volume = 1;
  loop = false;
  preload = "";
  src: string;
  constructor(src?: string) {
    this.src = src ?? "";
  }
  setAttribute(): void {}
  addEventListener(): void {}
  removeEventListener(): void {}
  pause(): void {
    this.paused = true;
  }
  play(): Promise<void> {
    if ((globalThis as { __userActivated?: boolean }).__userActivated) {
      this.paused = false;
      return Promise.resolve();
    }
    return Promise.reject(new DOMException("blocked", "NotAllowedError"));
  }
}

const SRC = "/audio/lofi.mp3";
// Drain several macrotask + microtask rounds so play() promises resolve and
// the setTimeout-driven fade loop runs to completion.
const flush = async () => {
  for (let i = 0; i < 12; i++) {
    await new Promise<void>((r) => setTimeout(r, 0));
  }
};

function setActivated(on: boolean) {
  (globalThis as { __userActivated?: boolean }).__userActivated = on;
}

async function freshPlayer() {
  vi.resetModules();
  const mod = await import("./musicPlayer");
  return mod.musicPlayer;
}

let fakeNow = 0;

beforeEach(() => {
  (globalThis as unknown as { Audio: typeof FakeAudio }).Audio = FakeAudio;
  setActivated(false);
  window.localStorage.clear();
  // rAF backed by setTimeout (no synchronous recursion), with performance.now
  // advancing in big steps so the fade reaches t>=1 within a couple of frames.
  fakeNow = 0;
  vi.spyOn(performance, "now").mockImplementation(() => (fakeNow += 800));
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) =>
    clearTimeout(id as unknown as ReturnType<typeof setTimeout>)) as typeof cancelAnimationFrame;
});

describe("musicPlayer — tap-to-play on strict mobile autoplay", () => {
  it("becomes audible after a SINGLE gesture, even when muted autoplay was blocked", async () => {
    const player = await freshPlayer();

    // 1. Cold mount: default-on auto-start with no gesture → blocked, silent.
    player.enable(SRC);
    await flush();
    await flush();
    expect(player.isPlaying()).toBe(false);

    // 2. User taps the toggle (one gesture). This is the real-world repro.
    setActivated(true);
    player.enable(SRC, { viaGesture: true });
    await flush();
    await flush();

    // Must be audible after ONE tap — not muted, not paused.
    expect(player.isPlaying()).toBe(true);
  });

  it("a single gesture unmutes audio that started muted (muted autoplay allowed case)", async () => {
    const player = await freshPlayer();

    // Allow the cold muted autoplay to start (element exists, but muted).
    setActivated(true);
    player.enable(SRC);
    await flush();
    await flush();

    // One gesture-initiated enable must leave it audible.
    player.enable(SRC, { viaGesture: true });
    await flush();
    await flush();
    expect(player.isPlaying()).toBe(true);
  });

  it("disable() after audible playback pauses and persists off", async () => {
    const player = await freshPlayer();
    setActivated(true);
    player.enable(SRC, { viaGesture: true });
    await flush();
    await flush();
    expect(player.isPlaying()).toBe(true);

    player.disable();
    await flush();
    expect(player.isPlaying()).toBe(false);
    expect(player.isPreferredOn()).toBe(false);
  });
});
