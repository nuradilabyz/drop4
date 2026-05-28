import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ColumnHeatmap } from "@/components/charts/ColumnHeatmap";
import { EloChart } from "@/components/charts/EloChart";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Nav } from "@/components/layout/Nav";
import { Avatar, Button, Card, Chip, Icon, StatTile } from "@/components/ui";
import {
  getMockProfile,
  getMockRecentMatches,
  type Achievement,
  type City,
  type Profile as MockProfile,
  type RecentMatch,
} from "@/lib/mockData";
import { createClient } from "@/lib/supabase/server";
import { getProfileByUsername, getRecentMatches } from "@/lib/db/queries";
import type { Match, Profile as CloudProfile } from "@/types/database";
import styles from "./profile.module.css";

const SUPABASE_CONFIGURED = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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
 * The achievement shelf the UI can render. Until we model these in the DB,
 * we lock everything that can't be derived from `profiles` columns on the
 * fly — so a brand-new account sees a row of locked badges, not a fake
 * highlight reel.
 */
const ACHIEVEMENT_SHELF: Omit<Achievement, "earned">[] = [
  { icon: "flame", name: "Hot streak", sub: "7 wins", accent: "coral" },
  { icon: "cup", name: "First win", sub: "vs human", accent: "gold" },
  { icon: "bolt", name: "Speed demon", sub: "<5min" },
  { icon: "cpu", name: "AI slayer", sub: "beat Insane", accent: "aqua" },
  { icon: "target", name: "Sniper", sub: "95% acc" },
  { icon: "crown", name: "Top 100", sub: "in city" },
];

function deriveAchievements(cloud: CloudProfile): {
  list: Achievement[];
  earnedCount: number;
} {
  const earned = new Set<string>();
  if (cloud.best_streak >= 7) earned.add("Hot streak");
  if (cloud.wins >= 1) earned.add("First win");
  // Speed demon / AI slayer / Sniper / Top 100 need separate counters or rank
  // lookups we don't store yet. Leave them locked rather than fake them.
  const list = ACHIEVEMENT_SHELF.map((a) => ({ ...a, earned: earned.has(a.name) }));
  return { list, earnedCount: list.filter((a) => a.earned).length };
}

/**
 * Build the Profile render-model from cloud columns only. No mock spread —
 * a brand-new account must NOT inherit Tigran's openings, achievements, or
 * the fake "+18 this week" delta. Sections that need data we don't have yet
 * (ELO history, per-column opening breakdown) render their own empty states.
 */
function buildProfileFromCloud(cloud: CloudProfile): MockProfile {
  const winRate =
    cloud.games > 0 ? Math.round((cloud.wins / cloud.games) * 100) : 0;
  const { list: achievements, earnedCount } = deriveAchievements(cloud);
  const hasGames = cloud.games > 0;
  return {
    username: cloud.username,
    name: cloud.display_name ?? cloud.username,
    handle: `@${cloud.username}`,
    city: asCity(cloud.city),
    joined: fmtJoined(cloud.created_at),
    isPro: cloud.is_pro,
    elo: cloud.elo,
    eloDelta: "",
    stats: [
      {
        label: "ELO",
        value: String(cloud.elo),
        sub: hasGames ? "" : "starting rating",
      },
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
        sub: "",
      },
      { label: "Avg game", value: fmtMs(cloud.avg_game_ms), sub: "" },
    ],
    openingByColumn: [0, 0, 0, 0, 0, 0, 0],
    achievements,
    achievementsEarned: earnedCount,
    achievementsTotal: achievements.length,
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

type ProfileData = {
  profile: MockProfile;
  matches: RecentMatch[];
  /** Real player with games on record. Cloud-only flag — mock demos default
   *  to true so the dev/preview render still shows the full layout. */
  hasPlayed: boolean;
};

function mockBundle(username: string): ProfileData {
  return {
    profile: getMockProfile(username),
    matches: getMockRecentMatches(username),
    hasPlayed: true,
  };
}

/**
 * Load real profile data from cloud, or signal "doesn't exist" with `null`.
 *
 * Strict semantics:
 *   - Supabase configured + lookup returns null → user really doesn't exist,
 *     caller should `notFound()`. We MUST NOT silently render the mock
 *     "tigran" profile under a stranger's URL.
 *   - Supabase configured + lookup *threw* (network/DB hiccup) → degrade to
 *     the mock so the page still loads instead of showing a 500 for a real
 *     user whose backend momentarily blipped.
 *   - Supabase NOT configured (dev/preview without env vars) → mock so the
 *     UI is still demoable.
 */
async function loadProfileData(username: string): Promise<ProfileData | null> {
  if (!SUPABASE_CONFIGURED) return mockBundle(username);

  let supabase;
  try {
    supabase = await createClient();
  } catch {
    return mockBundle(username);
  }

  let cloud: CloudProfile | null;
  try {
    cloud = await getProfileByUsername(supabase, username);
  } catch {
    return mockBundle(username);
  }
  if (!cloud) return null;

  const profile = buildProfileFromCloud(cloud);
  let matches: RecentMatch[] = [];
  try {
    const rows = await getRecentMatches(supabase, cloud.id, 8);
    matches = rows.map((m) => adaptMatch(m, cloud.id));
  } catch {
    /* swallow — empty matches list is the honest default */
  }
  return { profile, matches, hasPlayed: cloud.games > 0 };
}

export async function generateMetadata(props: ProfileRouteProps): Promise<Metadata> {
  const { username } = await props.params;
  const data = await loadProfileData(username);
  if (!data) {
    return {
      title: "Profile not found",
      description: "This player profile doesn't exist on Drop4.",
    };
  }
  const { profile } = data;
  return {
    title: `${profile.name} (${profile.handle})`,
    description: `${profile.name} · ${profile.elo} ELO · ${profile.city}. Match history, ELO trend, and achievements on Drop4.`,
  };
}

export default async function ProfilePage(props: ProfileRouteProps) {
  const { username } = await props.params;
  const data = await loadProfileData(username);
  if (!data) notFound();
  const { profile, matches, hasPlayed } = data;

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
            {hasPlayed ? (
              <Card padded>
                <EloChart username={profile.username} />
              </Card>
            ) : null}

            <Card padded={false}>
              <div className={styles.cardHead}>
                <span className={styles.cardTitle}>Recent matches</span>
                <span className={styles.cardCount}>{profile.recentTotal} total</span>
              </div>
              {matches.length === 0 ? (
                <div className={styles.emptyState}>
                  No matches yet. Once you play your first game it will show up
                  here.
                </div>
              ) : (
                matches.map((m, i) => (
                  <div
                    key={i}
                    className={styles.matchRow}
                    style={
                      i === matches.length - 1
                        ? { borderBottom: "none" }
                        : undefined
                    }
                  >
                    <span
                      className={[
                        styles.result,
                        m.result === "W" ? styles.win : styles.loss,
                      ].join(" ")}
                    >
                      {m.result}
                    </span>
                    <span className={styles.matchPlayer}>
                      <Avatar name={m.opponentName} size={24} />
                      <span className={styles.matchName}>{m.opponentName}</span>
                      {m.opponentElo !== null && (
                        <span className={`${styles.matchElo} mono`}>
                          {m.opponentElo}
                        </span>
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
                    <span className={`${styles.matchLen} ${styles.hideSm} mono`}>
                      {m.length}
                    </span>
                    <span className={`${styles.matchWhen} ${styles.hideSm}`}>
                      {m.when}
                    </span>
                  </div>
                ))
              )}
            </Card>
          </div>

          <div className={styles.col}>
            {hasPlayed ? (
              <Card padded>
                <div className={styles.cardHeadFlat}>
                  <span className={styles.cardTitle}>Opening preference</span>
                  <Chip tone="outline" size="sm">
                    By column
                  </Chip>
                </div>
                <ColumnHeatmap columns={profile.openingByColumn} />
              </Card>
            ) : null}

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
                    className={[styles.achievement, !a.earned && styles.locked]
                      .filter(Boolean)
                      .join(" ")}
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
