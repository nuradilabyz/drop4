import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";

// Placeholder landing — the full marketing landing is built in P1-C.
export default function Home() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 24,
        padding: 24,
        textAlign: "center",
      }}
    >
      <div style={{ position: "fixed", top: 20, right: 20 }}>
        <ThemeToggle />
      </div>
      <Logo size={34} />
      <Chip tone="coral" size="md" icon={<Icon name="spark" size={12} />}>
        v0.9 · Now with AI Coach
      </Chip>
      <h1 style={{ fontSize: 56, fontWeight: 600, letterSpacing: -2.2, lineHeight: 1.05, maxWidth: 560 }}>
        Four in a row.
        <br />
        Sharper every drop.
      </h1>
      <p style={{ color: "var(--text-dim)", maxWidth: 460, fontSize: 15 }}>
        A modern arena for the oldest tactical duel. Challenge a friend by link, drill against an AI
        that explains its moves, or climb your city&apos;s board.
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <Button variant="coral" size="lg" href="/play" iconRight={<Icon name="arrow" size={16} />}>
          Play now
        </Button>
        <Button variant="outline" size="lg" href="/playground">
          Design system
        </Button>
      </div>
      <Link href="/playground" style={{ fontSize: 12, color: "var(--text-mute)" }}>
        Drop4 · component playground
      </Link>
    </main>
  );
}
