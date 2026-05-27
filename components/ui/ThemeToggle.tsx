"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/lib/theme";
import { Icon } from "./Icon";

export interface ThemeToggleProps {
  size?: number;
  className?: string;
}

/** Round ghost button that flips light/dark. Renders a stable icon until mounted. */
export function ThemeToggle({ size = 34, className }: ThemeToggleProps) {
  const { theme, toggle } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={toggle}
      className={className}
      style={{
        width: size,
        height: size,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "50%",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text)",
        cursor: "pointer",
        boxShadow: "var(--shadow-sm)",
        transition: "background 0.13s var(--ease)",
      }}
    >
      <Icon name={mounted && theme === "light" ? "moon" : "sun"} size={16} />
    </button>
  );
}
