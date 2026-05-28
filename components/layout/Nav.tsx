import Link from "next/link";
import { Avatar, Button, Icon, Logo, ThemeToggle } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
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
 * Reads the auth session on the server. Returns the *real* profile only when
 * a non-anonymous user is signed in — anonymous-auth (used for duel guests)
 * MUST NOT light up the nav as "your profile", otherwise unsigned visitors
 * who happened to land on a duel link see somebody else's handle in the nav.
 */
async function loadMe(): Promise<{
  href: string;
  name: string;
  username: string;
} | null> {
  try {
    const supabase = await createClient();
    const { data: userResp } = await supabase.auth.getUser();
    const user = userResp.user;
    if (!user || user.is_anonymous) return null;

    const { data: profile } = await supabase
      .from("profiles")
      .select("username, display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile) return null;
    return {
      href: `/profile/${profile.username}`,
      name: profile.display_name || profile.username,
      username: profile.username,
    };
  } catch {
    // Treat any auth/DB hiccup as "not signed in" — never as the wrong user.
    return null;
  }
}

/**
 * Top navigation used on every marketing/profile page. Sticky, blurred, with a
 * border-bottom. Hidden under the mobile breakpoint (the MobileTabBar takes
 * over). The "you" slot on the right shows the signed-in user's avatar — or a
 * Sign-in button for guests. There is intentionally no fallback to mock data.
 */
export async function Nav({ active, className }: NavProps) {
  const me = await loadMe();

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
        {me ? (
          <Link href={me.href} aria-label={`Your profile (${me.name})`}>
            <Avatar name={me.name} size={32} />
          </Link>
        ) : (
          <Button variant="ghost" size="sm" href="/login">
            Sign in
          </Button>
        )}
      </div>
    </nav>
  );
}
