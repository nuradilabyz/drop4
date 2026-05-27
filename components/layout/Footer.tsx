import Link from "next/link";
import { Logo } from "@/components/ui";
import styles from "./Footer.module.css";

const FOOTER_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
  { label: "Discord", href: "https://discord.gg" },
];

/** Marketing footer. Matches landing.jsx: © line on the left, links on the right. */
export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.brand}>
        <Logo size={18} />
        <span>© 2026 Drop4 Labs</span>
      </div>
      <div className={styles.links}>
        {FOOTER_LINKS.map((l) => (
          <Link key={l.label} href={l.href} className={styles.link}>
            {l.label}
          </Link>
        ))}
        <span className={styles.status}>
          <span className={styles.dot} aria-hidden="true" />
          Status · operational
        </span>
      </div>
    </footer>
  );
}
