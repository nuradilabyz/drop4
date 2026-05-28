"use client";

/**
 * One-shot toast triggered by `?welcome=1` (set by `/auth/callback` after a
 * successful magic-link exchange) or `?auth_error=1` (callback failure).
 * Reads the flag once from `window.location` on mount, shows the message,
 * then strips the flag from the URL so a refresh doesn't replay it.
 *
 * We deliberately do NOT use `useSearchParams` here. With it, a router
 * update (or even a re-render handing back a fresh ReadonlyURLSearchParams
 * instance) re-ran the effect, whose cleanup `clearTimeout`'d the dismissal
 * before it could fire — the toast then sat on screen forever. Reading
 * `window.location.search` once on mount sidesteps that entirely.
 */

import { useEffect, useState } from "react";
import styles from "./Toast.module.css";

export function WelcomeToast() {
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const url = new URL(window.location.href);
    const welcome = url.searchParams.get("welcome");
    const authError = url.searchParams.get("auth_error");
    if (!welcome && !authError) return;

    setMessage(
      authError
        ? "We couldn't finish signing you in. Try the magic link again."
        : "You're signed in to Drop4. Welcome aboard.",
    );

    url.searchParams.delete("welcome");
    url.searchParams.delete("auth_error");
    const cleaned = url.pathname + (url.search || "") + url.hash;
    window.history.replaceState(null, "", cleaned);

    const t = window.setTimeout(() => setMessage(null), 3200);
    return () => window.clearTimeout(t);
  }, []);

  if (!message) return null;
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.toast}>{message}</div>
    </div>
  );
}
