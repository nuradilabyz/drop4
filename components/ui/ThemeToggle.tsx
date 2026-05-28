"use client";

import { useEffect, useState } from "react";
import { useStandaloneTheme, useThemeOptional } from "@/lib/theme";
import { Icon } from "./Icon";

export interface ThemeToggleProps {
  size?: number;
  className?: string;
  /**
   * When true, drive theme via the provider-free controller instead of the
   * <ThemeProvider> context. Used by the mobile floating cluster, which mounts
   * outside the provider subtree. Same DOM/storage semantics either way.
   */
  standalone?: boolean;
}

/** Round ghost button that flips light/dark. Renders a stable icon until mounted. */
export function ThemeToggle({ size = 34, className, standalone = false }: ThemeToggleProps) {
  // Hooks must be called unconditionally; pick the active source by `standalone`.
  const ctx = useThemeOptional();
  const standaloneCtx = useStandaloneTheme();
  const { theme, toggle } = standalone || !ctx ? standaloneCtx : ctx;
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
