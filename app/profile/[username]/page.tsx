import type { Metadata } from "next";
import { ColumnHeatmap } from "@/components/charts/ColumnHeatmap";
import { EloChart } from "@/components/charts/EloChart";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Nav } from "@/components/layout/Nav";
import { Avatar, Button, Card, Chip, Icon, StatTile } from "@/components/ui";
import { getMockProfile, getMockRecentMatches } from "@/lib/mockData";
import styles from "./profile.module.css";

// Next.js 16: route `params` is a Promise (see AGENTS.md). The generated
// `PageProps<'/profile/[username]'>` global resolves to this same shape once
// typegen runs; typing it inline keeps the file valid even with stale typegen.
interface ProfileRouteProps {
  params: Promise<{ username: string }>;
}

export async function generateMetadata(props: ProfileRouteProps): Promise<Metadata> {
  const { username } = await props.params;
  const profile = getMockProfile(username);
  return {
    title: `${profile.name} (${profile.handle})`,
    description: `${profile.name} · ${profile.elo} ELO · ${profile.city}. Match history, ELO trend, and achievements on Drop4.`,
  };
}

export default async function ProfilePage(props: ProfileRouteProps) {
  const { username } = await props.params;
  const profile = getMockProfile(username);
  const matches = getMockRecentMatches(username);

  return (
    <>
      <Nav />
      <main className={styles.main}>
        {/* Header */}
        <header className={styles.header}>
          <div className={styles.identity}>
            <Avatar name={profile.name} size={88} />
            <div>
              <div className={styles.nameRow}>
                <h1 className={styles.name}>{profile.name}</h1>
                {profile.isPro && (
                  <Chip tone="gold" size="md" icon={<Icon name="crown" size={11} />}>
                    Pro
                  </Chip>
                )}
              </div>
              <div className={styles.meta}>
                <span className={styles.metaItem}>
                  <Icon name="globe" size={12} /> {profile.city}
                </span>
                <span className={styles.dot}>·</span>
                <span>{profile.joined}</span>
                <span className={styles.dot}>·</span>
                <span className="mono">{profile.handle}</span>
              </div>
            </div>
          </div>
          <div className={styles.headerActions}>
            <Button variant="outline" size="md" href="/play" icon={<Icon name="share" size={13} />}>
              Share profile
            </Button>
            <Button variant="secondary" size="md" href="/play" icon={<Icon name="settings" size={13} />}>
              Settings
            </Button>
          </div>
        </header>

        {/* Stat tiles */}
        <div className={styles.stats}>
          {profile.stats.map((s) => (
            <StatTile
              key={s.label}
              label={s.label}
              value={<span className="mono">{s.value}</span>}
              sub={s.sub}
              accent={s.accent === "coral" ? "var(--coral)" : undefined}
            />
          ))}
        </div>

        {/* Body grid */}
        <div className={styles.body}>
          <div className={styles.col}>
            <Card padded>
              <EloChart username={profile.username} />
            </Card>

            <Card padded={false}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>Recent matches</span>
                <span className={styles.cardCount}>{profile.recentTotal} total</span>
              </div>
              {matches.map((m, i) => (
                <div
                  key={i}
                  className={styles.matchRow}
                  style={i === matches.length - 1 ? { borderBottom: "none" } : undefined}
                >
                  <span className={[styles.result, m.result === "W" ? styles.win : styles.loss].join(" ")}>
                    {m.result}
                  </span>
                  <span className={styles.matchPlayer}>
                    <Avatar name={m.opponentName} size={24} />
                    <span className={styles.matchName}>{m.opponentName}</span>
                    {m.opponentElo !== null && (
                      <span className={`${styles.matchElo} mono`}>{m.opponentElo}</span>
                    )}
                  </span>
                  <span className={styles.matchMode}>{m.mode}</span>
                  <span
                    className="mono"
                    style={{
                      fontSize: 12,
                      color: m.delta.startsWith("+")
                        ? "var(--success)"
                        : m.delta.startsWith("−")
                          ? "var(--danger)"
                          : "var(--text-mute)",
                    }}
                  >
                    {m.delta}
                  </span>
                  <span className={`${styles.matchLen} ${styles.hideSm} mono`}>{m.length}</span>
                  <span className={`${styles.matchWhen} ${styles.hideSm}`}>{m.when}</span>
                </div>
              ))}
            </Card>
          </div>

          <div className={styles.col}>
            <Card padded>
              <div className={styles.cardHeadFlat}>
                <span className={styles.cardTitle}>Opening preference</span>
                <Chip tone="outline" size="sm">
                  By column
                </Chip>
              </div>
              <ColumnHeatmap columns={profile.openingByColumn} />
            </Card>

            <Card padded={false}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>Achievements</span>
                <span className={`${styles.cardCount} mono`}>
                  {profile.achievementsEarned} / {profile.achievementsTotal}
                </span>
              </div>
              <div className={styles.achievements}>
                {profile.achievements.map((a) => (
                  <div
                    key={a.name}
                    className={[styles.achievement, !a.earned && styles.locked].filter(Boolean).join(" ")}
                  >
                    <span
                      className={styles.achievementIcon}
                      style={{
                        background: a.earned ? accentVar(a.accent) : "var(--surface-3)",
                        color: a.earned ? "var(--bg)" : "var(--text-mute)",
                      }}
                    >
                      <Icon name={a.icon} size={15} stroke={1.8} />
                    </span>
                    <div className={styles.achievementName}>{a.name}</div>
                    <div className={`${styles.achievementSub} mono`}>{a.sub}</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </div>
      </main>

      <Footer />
      <MobileTabBar />
    </>
  );
}

function accentVar(accent?: "coral" | "aqua" | "gold"): string {
  if (accent === "coral") return "var(--coral)";
  if (accent === "aqua") return "var(--aqua)";
  if (accent === "gold") return "var(--gold)";
  return "var(--text)";
}
