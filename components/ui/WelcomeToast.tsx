"use client";

/**
 * One-shot toast triggered by `?welcome=1` (set by `/auth/callback` after a
 * successful magic-link exchange) or `?auth_error=1` (callback failure).
 * Reads the flag from the URL, shows the message, then strips the flag so
 * a refresh doesn't replay it. Suspense-wrapped because `useSearchParams`
 * suspends in Next 16.
 */

import { Suspense, useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import styles from "./Toast.module.css";

function WelcomeToastInner() {
  const params = useSearchParams();
  const pathname = usePathname();
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const welcome = params.get("welcome");
    const authError = params.get("auth_error");
    if (!welcome && !authError) return;

    if (authError) {
      setMessage(
        "We couldn't finish signing you in. Try the magic link again.",
      );
    } else {
      setMessage("You're signed in to Drop4. Welcome aboard.");
    }

    // Strip the flag from the URL so refresh / back doesn't replay the toast.
    const next = new URLSearchParams(params.toString());
    next.delete("welcome");
    next.delete("auth_error");
    const qs = next.toString();
    window.history.replaceState(
      null,
      "",
      qs ? `${pathname}?${qs}` : pathname,
    );

    const t = setTimeout(() => setMessage(null), 4200);
    return () => clearTimeout(t);
  }, [params, pathname]);

  if (!message) return null;
  return (
    <div className={styles.wrap} role="status" aria-live="polite">
      <div className={styles.toast}>{message}</div>
    </div>
  );
}

export function WelcomeToast() {
  return (
    <Suspense fallback={null}>
      <WelcomeToastInner />
    </Suspense>
  );
}
