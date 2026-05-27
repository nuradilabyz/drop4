"use client";

/**
 * Playback controls (coach.jsx): first · prev · auto-play/pause · next · last.
 * Drives the scrub ply 0..total. Auto-play steps forward on an interval and
 * stops at the end.
 */

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui";
import { Icon } from "@/components/ui";
import styles from "./PlaybackControls.module.css";

export interface PlaybackControlsProps {
  /** 0-indexed current ply. */
  current: number;
  /** Total plies (current ranges 0..total-1). */
  total: number;
  playing: boolean;
  onChange: (ply: number) => void;
  onPlayingChange: (playing: boolean) => void;
  /** ms between auto-play steps. */
  stepMs?: number;
}

export function PlaybackControls({
  current,
  total,
  playing,
  onChange,
  onPlayingChange,
  stepMs = 900,
}: PlaybackControlsProps) {
  const last = Math.max(0, total - 1);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!playing) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }
    timer.current = setInterval(() => {
      onChange((prevSafe(current, last) ?? current));
    }, stepMs);
    return () => {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, current, last, stepMs]);

  // Advance via a derived setter so the interval always reads fresh `current`.
  function prevSafe(cur: number, max: number): number | null {
    if (cur >= max) {
      onPlayingChange(false);
      return null;
    }
    return cur + 1;
  }

  const goFirst = () => {
    onPlayingChange(false);
    onChange(0);
  };
  const goPrev = () => {
    onPlayingChange(false);
    onChange(Math.max(0, current - 1));
  };
  const goNext = () => {
    onPlayingChange(false);
    onChange(Math.min(last, current + 1));
  };
  const goLast = () => {
    onPlayingChange(false);
    onChange(last);
  };
  const toggle = () => {
    if (current >= last) onChange(0);
    onPlayingChange(!playing);
  };

  return (
    <div className={styles.bar}>
      <Button
        variant="ghost"
        size="sm"
        onClick={goFirst}
        aria-label="First move"
        icon={<Icon name="skipBack" size={14} />}
      />
      <Button
        variant="outline"
        size="sm"
        onClick={goPrev}
        aria-label="Previous move"
      >
        ⟨
      </Button>
      <Button
        variant="primary"
        size="md"
        onClick={toggle}
        icon={<Icon name={playing ? "pause" : "play"} size={12} />}
      >
        {playing ? "Pause" : "Auto-play"}
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={goNext}
        aria-label="Next move"
      >
        ⟩
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={goLast}
        aria-label="Last move"
        icon={<Icon name="skipFwd" size={14} />}
      />
    </div>
  );
}
