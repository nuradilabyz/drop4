"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { THEME_STORAGE_KEY, type Theme } from "@/lib/tokens";

interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function readDomTheme(): Theme {
  if (typeof document === "undefined") return "dark";
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

/**
 * Syncs a small React state mirror with the `data-theme` attribute on <html>.
 * The attribute is set pre-hydration by the bootstrap script in layout.tsx, so
 * there is no flash; this provider just keeps JS-readable state in step and
 * persists the user's explicit choice.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("dark");

  // Adopt whatever the pre-paint script decided, once mounted.
  useEffect(() => {
    setThemeState(readDomTheme());
  }, []);

  // Follow system changes only while the user hasn't chosen explicitly.
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: light)");
    const onChange = () => {
      if (localStorage.getItem(THEME_STORAGE_KEY)) return;
      const next: Theme = mq.matches ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      setThemeState(next);
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const setTheme = useCallback((t: Theme) => {
    document.documentElement.dataset.theme = t;
    try {
      localStorage.setItem(THEME_STORAGE_KEY, t);
    } catch {
      /* storage may be unavailable; the attribute is still set */
    }
    setThemeState(t);
  }, []);

  const toggle = useCallback(
    () => setTheme(readDomTheme() === "light" ? "dark" : "light"),
    [setTheme],
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within <ThemeProvider>");
  return ctx;
}
