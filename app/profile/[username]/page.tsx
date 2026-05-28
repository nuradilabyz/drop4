import type { Metadata } from "next";
import { ColumnHeatmap } from "@/components/charts/ColumnHeatmap";
import { EloChart } from "@/components/charts/EloChart";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Nav } from "@/components/layout/Nav";
import { Avatar, Button, Card, Chip, Icon, StatTile } from "@/components/ui";
import {
  getMockProfile,
  getMockRecentMatches,
  type City,
  type Profile as MockProfile,
  type RecentMatch,
} from "@/lib/mockData";
import { createClient } from "@/lib/supabase/server";
import { getProfileByUsername, getRecentMatches } from "@/lib/db/queries";
import type { Match, Profile as CloudProfile } from "@/types/database";
import styles from "./profile.module.css";

// Next.js 16: route `params` is a Promise (see AGENTS.md). The generated
// `PageProps<'/profile/[username]'>` global resolves to this same shape once
// typegen runs; typing it inline keeps the file valid even with stale typegen.
interface ProfileRouteProps {
  params: Promise<{ username: string }>;
}

const CITIES: City[] = ["Almaty", "Astana", "Shymkent", "Karagandy"];
function asCity(c: string | null | undefined): City {
  return CITIES.includes(c as City) ? (c as City) : "Almaty";
}

function fmtJoined(iso: string): string {
  const d = new Date(iso);
  const month = d.toLocaleString("en-US", { month: "short" });
  return `Joined ${month} ${d.getFullYear()}`;
}

function fmtMs(ms: number | null | undefined): string {
  if (!ms || !Number.isFinite(ms)) return "—";
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function relWhen(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "";
  const h = Math.floor(diff / 36e5);
  if (h < 1) return `${Math.max(1, Math.floor(diff / 6e4))}m ago`;
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

/**
 * Compose the Profile render-model from cloud + mock. Cloud powers the core
 * identity and stats; the things we don't yet store (per-column opening
 * breakdown, named achievements) come from the mock so the page stays full.
 */
function mergeCloudProfile(cloud: CloudProfile, mock: MockProfile): MockProfile {
  const winRate = cloud.games > 0 ? Math.round((cloud.wins / cloud.games) * 100) : 0;
  return {
    ...mock,
    username: cloud.username,
    name: cloud.display_name ?? cloud.username,
    handle: `@${cloud.username}`,
    city: asCity(cloud.city),
    joined: fmtJoined(cloud.created_at),
    isPro: cloud.is_pro,
    elo: cloud.elo,
    eloDelta: mock.eloDelta, // weekly delta needs an elo_snapshots lookup; mock for now
    stats: [
      { label: "ELO", value: String(cloud.elo), sub: mock.eloDelta + " this week" },
      {
        label: "Win rate",
        value: `${winRate}%`,
        sub: `${cloud.wins} / ${cloud.games} games`,
      },
      {
        label: "Win streak",
        value: String(cloud.streak),
        sub: `personal best ${cloud.best_streak}`,
        accent: cloud.streak >= 5 ? "coral" : undefined,
      },
      {
        label: "Favorite opening",
        value: cloud.favorite_col != null ? `col ${cloud.favorite_col + 1}` : "—",
        sub: mock.stats[3]?.sub ?? "",
      },
      { label: "Avg game", value: fmtMs(cloud.avg_game_ms), sub: mock.stats[4]?.sub ?? "" },
    ],
    recentTotal: cloud.games,
  };
}

function adaptMatch(m: Match, viewerId: string): RecentMatch {
  const viewerIsP1 = m.player1_id === viewerId;
  const opponentId = viewerIsP1 ? m.player2_id : m.player1_id;
  const won =
    (viewerIsP1 && m.result === "p1") || (!viewerIsP1 && m.result === "p2");
  const isAi = m.mode === "solo" && opponentId === null;
  return {
    result: won ? "W" : "L",
    opponentName: isAi
      ? `${(m.ai_difficulty ?? "AI").replace(/^\w/, (c) => c.toUpperCase())} AI`
      : "Opponent",
    opponentUsername: undefined,
    opponentElo: null,
    mode:
      m.mode === "ranked"
        ? "Ranked"
        : m.mode === "duel"
          ? "Duel"
          : isAi
            ? `${m.ai_difficulty ?? "Hard"} AI`
            : "Solo",
    delta:
      m.elo_delta != null
        ? m.elo_delta >= 0
          ? `+${m.elo_delta}`
          : `−${Math.abs(m.elo_delta)}`
        : "—",
    length: fmtMs(m.duration_ms),
    when: relWhen(m.ended_at ?? m.created_at),
  };
}

async function loadProfileData(
  username: string,
): Promise<{ profile: MockProfile; matches: RecentMatch[] }> {
  const fallback = {
    profile: getMockProfile(username),
    matches: getMockRecentMatches(username),
  };
  try {
    const supabase = await createClient();
    const cloud = await getProfileByUsername(supabase, username);
    if (!cloud) return fallback;
    const profile = mergeCloudProfile(cloud, fallback.profile);
    let matches = fallback.matches;
    try {
      const rows = await getRecentMatches(supabase, cloud.id, 8);
      if (rows.length > 0) matches = rows.map((m) => adaptMatch(m, cloud.id));
    } catch {
      /* keep mock matches */
    }
    return { profile, matches };
  } catch {
    return fallback;
  }
}

export async function generateMetadata(props: ProfileRouteProps): Promise<Metadata> {
  const { username } = await props.params;
  const { profile } = await loadProfileData(username);
  return {
    title: `${profile.name} (${profile.handle})`,
    description: `${profile.name} · ${profile.elo} ELO · ${profile.city}. Match history, ELO trend, and achievements on Drop4.`,
  };
}

export default async function ProfilePage(props: ProfileRouteProps) {
  const { username } = await props.params;
  const { profile, matches } = await loadProfileData(username);

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
