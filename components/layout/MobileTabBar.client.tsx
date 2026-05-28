"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import styles from "./MobileTabBar.module.css";

type TabKey = "home" | "coach" | "board" | "me";

interface Tab {
  key: TabKey;
  label: string;
  href: string;
  /** 16×16 SVG path, ported from mobile.jsx. */
  path: string;
}

export interface MobileTabBarClientProps {
  /** Resolved on the server from the auth session: profile route for signed-in
   *  users, /login for guests. */
  meHref: string;
  meLabel: string;
}

function activeKey(pathname: string, meHref: string): TabKey {
  if (pathname.startsWith("/profile") || pathname === meHref) return "me";
  if (pathname.startsWith("/coach")) return "coach";
  if (pathname.startsWith("/play")) return "board";
  return "home";
}

/**
 * Bottom tab bar (from mobile.jsx). Only visible under the mobile breakpoint;
 * the top Nav hides at the same width. Highlights the tab matching the route.
 */
export function MobileTabBarClient({ meHref, meLabel }: MobileTabBarClientProps) {
  const pathname = usePathname();
  const tabs: Tab[] = [
    { key: "home", label: "Home", href: "/", path: "M2 7l6-5 6 5v6a1 1 0 01-1 1H3a1 1 0 01-1-1z" },
    { key: "coach", label: "Coach", href: "/coach", path: "M8 2l1.5 4.5L14 8l-4.5 1.5L8 14l-1.5-4.5L2 8l4.5-1.5z" },
    { key: "board", label: "Board", href: "/play", path: "M2 2h12v12H2z M2 6h12 M2 10h12 M6 2v12 M10 2v12" },
    { key: "me", label: meLabel, href: meHref, path: "M8 8a3 3 0 100-6 3 3 0 000 6zM2 14c1-3 3.5-4 6-4s5 1 6 4" },
  ];
  const active = activeKey(pathname, meHref);

  return (
    <nav className={styles.bar} aria-label="Primary">
      {tabs.map((t) => {
        const on = active === t.key;
        return (
          <Link
            key={t.key}
            href={t.href}
            className={[styles.tab, on && styles.on].filter(Boolean).join(" ")}
            aria-current={on ? "page" : undefined}
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth={on ? 2 : 1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d={t.path} />
            </svg>
            <span>{t.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
