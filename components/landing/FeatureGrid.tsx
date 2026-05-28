"use client";

/**
 * Wrapper that animates the "Three ways to play" cards in once, when the
 * grid first enters the viewport. Adds `.cascadeIn` to the grid container
 * on first intersection — the CSS in landing.module.css then runs a
 * staggered `drop4-fade-up` per `.featureCard:nth-child(N)`. Disconnects
 * the observer after firing so re-scrolling does nothing.
 *
 * If IntersectionObserver isn't available (very old browsers, tests), the
 * class is added immediately so the cards never end up hidden.
 */

import { useEffect, useRef, useState, type ReactNode } from "react";
import styles from "@/app/landing.module.css";

export function FeatureGrid({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [cascade, setCascade] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (typeof IntersectionObserver === "undefined") {
      setCascade(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setCascade(true);
            io.disconnect();
            return;
          }
        }
      },
      { threshold: 0.25 },
    );
    io.observe(node);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={[styles.features, cascade && styles.cascadeIn]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}
