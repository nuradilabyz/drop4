"use client";

/**
 * Tiny ephemeral toast for transient confirmations ("Link copied").
 * Controlled via the `useToast` hook so callers own the message lifecycle and
 * the component itself stays a pure render of `message | null`. No portal,
 * no provider — it renders `position: fixed` wherever it's mounted.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./Toast.module.css";

export function useToast(durationMs = 1900) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback(
    (msg: string) => {
      setMessage(msg);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), durationMs);
    },
    [durationMs],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  return { message, show };
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.toast}>{message}</div>
    </div>
  );
}
