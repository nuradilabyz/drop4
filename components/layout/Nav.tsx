import Link from "next/link";
import { Avatar, Button, Icon, Logo, ThemeToggle } from "@/components/ui";
import styles from "./Nav.module.css";

export interface NavProps {
  /** Highlights the matching link. */
  active?: "Play" | "Coach" | "Leaderboard" | "Pricing";
  className?: string;
}

const LINKS: { label: NonNullable<NavProps["active"]>; href: string }[] = [
  { label: "Play", href: "/play" },
  { label: "Coach", href: "/coach" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Pricing", href: "/pricing" },
];

/**
 * Top navigation used on every marketing/profile page. Sticky, blurred, with a
 * border-bottom. Hidden under the mobile breakpoint (the MobileTabBar takes
 * over). Style only with tokens; no app/layout.tsx changes.
 */
export function Nav({ active, className }: NavProps) {
  return (
    <nav className={[styles.nav, className].filter(Boolean).join(" ")}>
      <div className={styles.left}>
        <Link href="/" aria-label="Drop4 home">
          <Logo size={22} />
        </Link>
        <div className={styles.links}>
          {LINKS.map((l) => (
            <Link
              key={l.label}
              href={l.href}
              className={[styles.link, active === l.label && styles.active]
                .filter(Boolean)
                .join(" ")}
            >
              {l.label}
            </Link>
          ))}
        </div>
      </div>

      <div className={styles.right}>
        <Button variant="primary" size="sm" href="/play" iconRight={<Icon name="arrow" size={13} />}>
          Play
        </Button>
        <ThemeToggle size={34} />
        <Link href="/profile/tigran.dvk" aria-label="Your profile">
          <Avatar name="Tigran D." size={32} />
        </Link>
      </div>
    </nav>
  );
}
