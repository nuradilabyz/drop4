import Link from "next/link";
import { Board } from "@/components/board/Board";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Nav } from "@/components/layout/Nav";
import { Avatar, Button, Card, Chip, Icon } from "@/components/ui";
import { BOARD_HERO } from "@/lib/sampleBoards";
import { FEATURE_CARDS, TRUST_METRICS } from "@/lib/mockData";
import { LeaderboardPreview } from "./LeaderboardPreview";
import styles from "./landing.module.css";

export default function Home() {
  return (
    <>
      <Nav active="Play" />
      <main className={styles.main}>
        {/* ─── Hero ─── */}
        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <Chip
              tone="outline"
              size="md"
              icon={<span className={styles.versionDot} aria-hidden="true" />}
            >
              v0.9 · Now with AI Coach
            </Chip>
            <h1 className={styles.heroTitle}>
              Four in a row.
              <br />
              <span className={styles.dim}>Sharper every drop.</span>
            </h1>
            <p className={styles.heroSub}>
              A modern arena for the oldest tactical duel. Challenge a friend by link, drill against
              an AI that explains its moves, or climb your city&apos;s board.
            </p>
            <div className={styles.heroCtas}>
              <Button variant="primary" size="lg" href="/play" iconRight={<Icon name="arrow" size={14} />}>
                Play now
              </Button>
              <Button variant="outline" size="lg" href="/play" icon={<Icon name="link" size={14} />}>
                Create room link
              </Button>
              <span className={styles.onlinePill}>
                <span className={styles.onlineDot} aria-hidden="true" />
                <span className="mono">2,847</span> online
              </span>
            </div>

            <div className={styles.trust}>
              {TRUST_METRICS.map((m) => (
                <div key={m.label} className={styles.trustItem}>
                  <div className={`${styles.trustValue} mono`}>{m.value}</div>
                  <div className={styles.trustLabel}>{m.label}</div>
                </div>
              ))}
            </div>
          </div>

          <HeroBoard />
        </section>

        {/* ─── Feature cards ─── */}
        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2 className={styles.sectionTitle}>Three ways to play.</h2>
            <span className={styles.sectionAside}>No download. Browser tab to gym.</span>
          </div>
          <div className={styles.features}>
            {FEATURE_CARDS.map((f) => (
              <Card key={f.kicker} padded={false} className={styles.featureCard}>
                <div className={styles.featurePreview}>
                  <FeaturePreview kind={f.preview} />
                </div>
                <div className={styles.featureBody}>
                  <div
                    className={`${styles.featureKicker} mono`}
                    style={{ color: f.accent === "aqua" ? "var(--aqua)" : "var(--coral)" }}
                  >
                    {f.kicker}
                  </div>
                  <h3 className={styles.featureTitle}>{f.title}</h3>
                  <p className={styles.featureText}>{f.body}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* ─── City leaderboard preview ─── */}
        <section className={styles.section}>
          <div className={styles.cityGrid}>
            <div>
              <Chip tone="outline" size="md">
                City rankings
              </Chip>
              <h2 className={styles.cityTitle}>
                Become the
                <br /> best in <span className={styles.coral}>Almaty.</span>
              </h2>
              <p className={styles.cityText}>
                Live ELO across 64 cities. Beat the regulars in your café, then take on the world.
              </p>
              <Button variant="outline" size="md" href="/leaderboard" iconRight={<Icon name="chevR" size={12} />}>
                See full board
              </Button>
            </div>
            <LeaderboardPreview />
          </div>
        </section>

        {/* ─── Pro CTA ─── */}
        <section className={styles.section}>
          <div className={styles.proCta}>
            <div className={styles.proCopy}>
              <Chip tone="gold" size="md" icon={<Icon name="crown" size={11} />}>
                Drop4 Pro
              </Chip>
              <h3 className={styles.proTitle}>
                Sharper coach. Custom skins.
                <br />
                Unlimited hints.
              </h3>
              <p className={styles.proSub}>$4/month, or $36/year. Cancel anytime.</p>
            </div>
            <div className={styles.proButtons}>
              <Button variant="outline" size="lg" href="/pricing">
                Compare plans
              </Button>
              <Button variant="coral" size="lg" href="/pricing" iconRight={<Icon name="arrow" size={14} />}>
                Upgrade to Pro
              </Button>
            </div>
            <svg className={styles.proPattern} width="200" height="200" aria-hidden="true">
              <circle cx="40" cy="40" r="28" fill="var(--coral)" />
              <circle cx="120" cy="60" r="28" fill="var(--aqua)" />
              <circle cx="80" cy="130" r="28" fill="var(--coral)" />
              <circle cx="160" cy="140" r="28" fill="var(--aqua)" />
            </svg>
          </div>
        </section>
      </main>

      <Footer />
      <MobileTabBar />
    </>
  );
}

/* ─── Hero board with floating "live" chips ─────────────────────────────── */
function HeroBoard() {
  return (
    <div className={styles.heroBoardWrap}>
      <div className={styles.heroGlow} aria-hidden="true" />
      <div className={styles.heroBoardTilt}>
        <Board cells={BOARD_HERO} size="lg" nextPlayer="a" />

        <div className={`${styles.floatCard} ${styles.floatThinking}`}>
          <Avatar name="Aigerim K." size={28} />
          <div>
            <div className={styles.floatName}>Aigerim · 1882</div>
            <div className={`${styles.floatMeta} mono`}>thinking…</div>
          </div>
          <div className={styles.thinkingDots} aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
        </div>

        <div className={`${styles.floatCard} ${styles.floatBest}`}>
          <div className={styles.bestHead}>
            <span className={styles.bestKicker}>
              <Icon name="bolt" size={10} color="var(--gold)" /> Best move
            </span>
            <Chip tone="gold" size="sm">
              Pro
            </Chip>
          </div>
          <div className={styles.bestValue}>
            <span className={`${styles.bestCol} mono`}>Col 5</span>
            <span className={`${styles.bestScore} mono`}>+2.4</span>
          </div>
        </div>

        <div className={`${styles.floatTurn} mono`}>
          <Icon name="bolt" size={12} color="var(--coral)" />
          <span>Your turn · 0:18</span>
        </div>
      </div>
    </div>
  );
}

/* ─── Mini previews for feature cards ───────────────────────────────────── */
function FeaturePreview({ kind }: { kind: "ai" | "link" | "coach" }) {
  if (kind === "ai") {
    return (
      <div className={styles.aiPreview}>
        <div className={styles.aiBadge}>
          <Icon name="cpu" size={28} stroke={1.4} />
        </div>
        <div className={`${styles.aiLines} mono`}>
          <div>{">"} difficulty: <span className={styles.aiHi}>insane</span></div>
          <div>{">"} depth: <span className={styles.aiHi}>12 ply</span></div>
          <div>{">"} <span className={styles.coral}>your move…</span></div>
        </div>
      </div>
    );
  }
  if (kind === "link") {
    return (
      <div className={`${styles.linkPreview} mono`}>
        <span className={styles.linkDim}>drop4.gg/r/</span>
        <span className={styles.linkSlug}>aigerim-vs-you</span>
        <span className={styles.linkCopy}>
          <Icon name="copy" size={11} /> Copy
        </span>
      </div>
    );
  }
  return (
    <div className={styles.coachPreview} aria-hidden="true">
      {Array.from({ length: 14 }, (_, i) => {
        const h = 10 + Math.sin(i * 0.7) * 20 + (i > 8 ? 14 : 0) + (i === 11 ? 28 : 0);
        const isP1 = i % 2 === 0;
        const isKey = i === 11;
        return (
          <div
            key={i}
            className={[styles.coachBar, isKey && styles.coachKey].filter(Boolean).join(" ")}
            style={{
              height: `${Math.abs(h) + 10}px`,
              background: isKey
                ? "var(--coral)"
                : isP1
                  ? "color-mix(in oklab, var(--coral) 38%, transparent)"
                  : "color-mix(in oklab, var(--aqua) 38%, transparent)",
            }}
          />
        );
      })}
    </div>
  );
}
