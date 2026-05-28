/**
 * Drop4 mock data — the data seam for the static marketing & profile screens.
 *
 * Everything the landing / leaderboard / profile / pricing pages render flows
 * through the typed accessor functions exported here. When the real Supabase
 * queries land (built by another agent), they replace the bodies of
 * `getMockProfile`, `getMockLeaderboard`, etc. — the call sites and types stay.
 *
 * Numbers are deterministic (no Math.random) so server and client render the
 * same thing and snapshots stay stable.
 */

import type { IconName } from "@/components/ui";

// ─── Shared scalar types ────────────────────────────────────────────────────

export type City = "Almaty" | "Astana" | "Shymkent" | "Karagandy";
export const CITIES: City[] = ["Almaty", "Astana", "Shymkent", "Karagandy"];

export type LeaderboardPeriod = "weekly" | "alltime";

/** Match outcome from the profile owner's perspective. */
export type MatchResult = "W" | "L";

// ─── Trust metrics (landing) ────────────────────────────────────────────────

export interface TrustMetric {
  value: string;
  label: string;
}

export const TRUST_METRICS: TrustMetric[] = [
  { value: "2,847", label: "online now" },
  { value: "1.2M", label: "games this week" },
  { value: "180ms", label: "avg matchmaking" },
  { value: "64", label: "cities ranked" },
];

// ─── Landing feature cards ──────────────────────────────────────────────────

export interface FeatureCard {
  kicker: string;
  title: string;
  body: string;
  /** Visual accent for the kicker / preview. */
  accent: "coral" | "aqua";
  /** Which preview to render in the card head. */
  preview: "ai" | "link" | "coach";
}

export const FEATURE_CARDS: FeatureCard[] = [
  {
    kicker: "01 — Solo",
    title: "Train against an AI that talks back.",
    body: "Four difficulty curves from Easy to Insane. Every loss earns a one-line postmortem.",
    accent: "coral",
    preview: "ai",
  },
  {
    kicker: "02 — Duel",
    title: "One link. Your friend. Anywhere.",
    body: "No signups, no rooms, no codes. Paste the link and the game starts.",
    accent: "aqua",
    preview: "link",
  },
  {
    kicker: "03 — Coach",
    title: "See the move you should have made.",
    body: "Postgame analysis with a move timeline and the AI's preferred line at every turn.",
    accent: "coral",
    preview: "coach",
  },
];

// ─── Leaderboard ────────────────────────────────────────────────────────────

export interface LeaderboardRow {
  rank: number;
  username: string;
  name: string;
  elo: number;
  /** Signed weekly ELO delta, already formatted (e.g. "+42", "−6"). */
  delta: string;
  city: City;
  wins: number;
  losses: number;
  /** Special row treatment. */
  tag?: "gold" | "self";
}

/** Master ranked table (all-time order). City/period filtering derives from this. */
const LEADERBOARD: LeaderboardRow[] = [
  { rank: 1, username: "mareke_ai", name: "mareke_ai", elo: 1934, delta: "+42", city: "Almaty", wins: 142, losses: 38, tag: "gold" },
  { rank: 2, username: "aigerim.k", name: "Aigerim K.", elo: 1882, delta: "+11", city: "Astana", wins: 88, losses: 41 },
  // No `tag: "self"` here — the "You" highlight must come from the real auth
  // session, never from a hardcoded mock row that would otherwise label a
  // stranger's name as the visitor's own in unconfigured fallbacks.
  { rank: 3, username: "tigran.dvk", name: "tigran.dvk", elo: 1847, delta: "+18", city: "Almaty", wins: 142, losses: 80 },
  { rank: 4, username: "serikbol_99", name: "serikbol_99", elo: 1821, delta: "−6", city: "Almaty", wins: 76, losses: 39 },
  { rank: 5, username: "arman_94", name: "arman_94", elo: 1812, delta: "+24", city: "Shymkent", wins: 64, losses: 33 },
  { rank: 6, username: "daria.f", name: "Daria F.", elo: 1804, delta: "+8", city: "Almaty", wins: 88, losses: 51 },
  { rank: 7, username: "kenes.bk", name: "kenes.bk", elo: 1798, delta: "+14", city: "Astana", wins: 52, losses: 28 },
  { rank: 8, username: "ainara_q", name: "ainara_q", elo: 1781, delta: "−2", city: "Almaty", wins: 90, losses: 62 },
  { rank: 9, username: "rustem_xx", name: "rustem_xx", elo: 1770, delta: "+5", city: "Karagandy", wins: 44, losses: 27 },
  { rank: 10, username: "aliya.m", name: "Aliya M.", elo: 1762, delta: "+12", city: "Almaty", wins: 38, losses: 22 },
  { rank: 11, username: "bek_dauren", name: "Bek Dauren", elo: 1748, delta: "+9", city: "Astana", wins: 71, losses: 48 },
  { rank: 12, username: "zhanel_07", name: "zhanel_07", elo: 1731, delta: "−4", city: "Shymkent", wins: 33, losses: 21 },
  { rank: 13, username: "olzhas.t", name: "Olzhas T.", elo: 1719, delta: "+16", city: "Karagandy", wins: 58, losses: 40 },
  { rank: 14, username: "madina_z", name: "Madina Z.", elo: 1702, delta: "+3", city: "Almaty", wins: 47, losses: 35 },
  { rank: 15, username: "nurlan.k", name: "Nurlan K.", elo: 1688, delta: "−7", city: "Astana", wins: 29, losses: 24 },
  { rank: 16, username: "askar_t", name: "Askar T.", elo: 1741, delta: "+6", city: "Shymkent", wins: 51, losses: 34 },
  { rank: 17, username: "gulnaz.s", name: "Gulnaz S.", elo: 1709, delta: "+13", city: "Shymkent", wins: 40, losses: 29 },
  { rank: 18, username: "timur_kz", name: "Timur K.", elo: 1696, delta: "−3", city: "Shymkent", wins: 26, losses: 20 },
  { rank: 19, username: "dana_07", name: "Dana M.", elo: 1733, delta: "+8", city: "Karagandy", wins: 49, losses: 31 },
  { rank: 20, username: "yerlan.b", name: "Yerlan B.", elo: 1714, delta: "+2", city: "Karagandy", wins: 37, losses: 28 },
  { rank: 21, username: "sabina_x", name: "Sabina A.", elo: 1690, delta: "+10", city: "Karagandy", wins: 31, losses: 25 },
];

/**
 * Returns the leaderboard for a city + period, re-ranked 1..N for that slice.
 * Period currently only shuffles deltas slightly so the toggle is visibly live;
 * the real query will sort by the period's ELO snapshot.
 */
export function getMockLeaderboard(
  city: City,
  period: LeaderboardPeriod = "weekly",
): LeaderboardRow[] {
  const slice = LEADERBOARD.filter((r) => r.city === city).sort((a, b) => b.elo - a.elo);
  return slice.map((row, i) => ({
    ...row,
    rank: i + 1,
    // #1 of a city slice wears the champ crown; others keep their self/no tag.
    tag: i === 0 ? "gold" : row.tag === "self" ? "self" : undefined,
    delta: period === "alltime" ? formatDelta(row.elo - 1700) : row.delta,
  }));
}

/** Top-3 podium rows for a city/period (rank-2, rank-1, rank-3 display order). */
export function getMockPodium(city: City, period: LeaderboardPeriod = "weekly"): LeaderboardRow[] {
  const top = getMockLeaderboard(city, period).slice(0, 3);
  // visual order: 2nd, 1st (center), 3rd
  return [top[1], top[0], top[2]].filter(Boolean);
}

/** Compact 5-row preview for the landing's city board (always Almaty/weekly). */
export function getLandingLeaderboard(): LeaderboardRow[] {
  return [
    { rank: 1, username: "mareke_ai", name: "mareke_ai", elo: 1934, delta: "+42", city: "Almaty", wins: 142, losses: 38, tag: "gold" },
    { rank: 2, username: "aigerim.k", name: "Aigerim K.", elo: 1882, delta: "+11", city: "Almaty", wins: 88, losses: 41 },
    { rank: 3, username: "tigran.dvk", name: "tigran.dvk", elo: 1847, delta: "−6", city: "Almaty", wins: 142, losses: 80 },
    { rank: 4, username: "serikbol_99", name: "serikbol_99", elo: 1821, delta: "+18", city: "Almaty", wins: 76, losses: 39 },
    // Defensive: no hard-coded "self" — the leaderboard highlight must always
    // be wired up to the real signed-in user, not pre-baked in mock fallbacks.
    { rank: 5, username: "you", name: "Anonymous", elo: 1798, delta: "+24", city: "Almaty", wins: 70, losses: 44 },
  ];
}

function formatDelta(n: number): string {
  if (n === 0) return "0";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

// ─── Profile ────────────────────────────────────────────────────────────────

export interface ProfileStat {
  label: string;
  value: string;
  sub: string;
  accent?: "coral";
}

export interface RecentMatch {
  result: MatchResult;
  opponentName: string;
  opponentUsername?: string;
  opponentElo: number | null;
  mode: string;
  /** Formatted ELO delta or "—" for unranked. */
  delta: string;
  length: string;
  when: string;
}

export interface Achievement {
  icon: IconName;
  name: string;
  sub: string;
  earned: boolean;
  accent?: "coral" | "aqua" | "gold";
}

/** ELO time series, indexed oldest → newest. */
export interface EloSeries {
  /** Daily ELO values. */
  values: number[];
  /** Label for the window (e.g. "Last 30 days"). */
  label: string;
}

export type EloRange = "7d" | "30d" | "all";

export interface Profile {
  username: string;
  name: string;
  handle: string;
  city: City;
  joined: string;
  isPro: boolean;
  elo: number;
  eloDelta: string;
  stats: ProfileStat[];
  /** Opening preference by column (7 entries, fractions summing ~1). */
  openingByColumn: number[];
  achievements: Achievement[];
  achievementsEarned: number;
  achievementsTotal: number;
  recentTotal: number;
}

const TIGRAN: Profile = {
  username: "tigran.dvk",
  name: "Tigran D.",
  handle: "@tigran.dvk",
  city: "Almaty",
  joined: "Joined Feb 2026",
  isPro: true,
  elo: 1847,
  eloDelta: "+18",
  stats: [
    { label: "ELO", value: "1847", sub: "+18 this week" },
    { label: "Win rate", value: "64%", sub: "142 / 222 games" },
    { label: "Win streak", value: "7", sub: "personal best 11", accent: "coral" },
    { label: "Favorite opening", value: "col 4", sub: "38% of games" },
    { label: "Avg game", value: "12:18", sub: "8% faster than peers" },
  ],
  openingByColumn: [0.04, 0.08, 0.14, 0.38, 0.18, 0.12, 0.06],
  achievements: [
    { icon: "flame", name: "Hot streak", sub: "7 wins", earned: true, accent: "coral" },
    { icon: "cup", name: "First win", sub: "vs human", earned: true, accent: "gold" },
    { icon: "bolt", name: "Speed demon", sub: "<5min", earned: true },
    { icon: "cpu", name: "AI slayer", sub: "beat Insane", earned: true, accent: "aqua" },
    { icon: "target", name: "Sniper", sub: "95% acc", earned: false },
    { icon: "crown", name: "Top 100", sub: "in city", earned: false },
  ],
  achievementsEarned: 14,
  achievementsTotal: 32,
  recentTotal: 222,
};

/** 30 daily ELO points, ~1700–1850, trending up (landing/profile chart). */
const ELO_HISTORY: number[] = [
  1730, 1722, 1740, 1755, 1748, 1762, 1759, 1770, 1768, 1780, 1771, 1785, 1798,
  1788, 1795, 1802, 1810, 1808, 1815, 1822, 1815, 1830, 1818, 1832, 1820, 1828,
  1838, 1842, 1835, 1847,
];

const RECENT_MATCHES: RecentMatch[] = [
  { result: "W", opponentName: "Aigerim K.", opponentUsername: "aigerim.k", opponentElo: 1882, mode: "Ranked", delta: "+24", length: "12:04", when: "2h ago" },
  { result: "W", opponentName: "mareke_ai", opponentElo: null, mode: "Insane AI", delta: "—", length: "6:18", when: "4h ago" },
  { result: "L", opponentName: "serikbol_99", opponentUsername: "serikbol_99", opponentElo: 1821, mode: "Ranked", delta: "−18", length: "18:42", when: "Yesterday" },
  { result: "W", opponentName: "Daria F.", opponentUsername: "daria.f", opponentElo: 1654, mode: "Duel link", delta: "—", length: "8:51", when: "Yesterday" },
  { result: "W", opponentName: "kenes.bk", opponentUsername: "kenes.bk", opponentElo: 1701, mode: "Quick match", delta: "+11", length: "14:22", when: "2d ago" },
  { result: "L", opponentName: "mareke_ai", opponentElo: null, mode: "Insane AI", delta: "—", length: "21:08", when: "2d ago" },
];

/**
 * Returns the profile for a username. Unknown usernames fall back to the demo
 * profile (Tigran) re-skinned with the requested handle so deep links never 404
 * during the static phase. The real query will return null → notFound().
 */
export function getMockProfile(username: string): Profile {
  if (username === TIGRAN.username || username === "tigran") return TIGRAN;
  const known = LEADERBOARD.find((r) => r.username === username);
  if (known) {
    return {
      ...TIGRAN,
      username: known.username,
      name: known.name,
      handle: `@${known.username}`,
      city: known.city,
      isPro: known.tag === "gold",
      elo: known.elo,
      eloDelta: known.delta,
      stats: [
        { label: "ELO", value: String(known.elo), sub: `${known.delta} this week` },
        ...TIGRAN.stats.slice(1),
      ],
    };
  }
  return { ...TIGRAN, username, name: username, handle: `@${username}` };
}

/** ELO history series for a profile + range window. */
export function getMockEloHistory(_username: string, range: EloRange = "30d"): EloSeries {
  if (range === "7d") {
    return { values: ELO_HISTORY.slice(-7), label: "Last 7 days" };
  }
  if (range === "all") {
    // Stitch a longer, lower-starting tail before the 30-day window.
    const tail = [1610, 1632, 1648, 1655, 1672, 1668, 1690, 1705, 1698, 1715];
    return { values: [...tail, ...ELO_HISTORY], label: "All time" };
  }
  return { values: ELO_HISTORY, label: "Last 30 days" };
}

/** Recent matches for a profile (most recent first). */
export function getMockRecentMatches(_username: string): RecentMatch[] {
  return RECENT_MATCHES;
}

// ─── Pricing ────────────────────────────────────────────────────────────────

export type PricingFeatureIcon = "check" | "x" | "spark";

export interface PricingFeature {
  icon: PricingFeatureIcon;
  text: string;
}

export interface PricingTier {
  id: "free" | "pro" | "team";
  name: string;
  price: string;
  per: string;
  desc: string;
  cta: string;
  ctaVariant: "primary" | "outline";
  /** Stripe checkout target; null for plans without a self-serve checkout. */
  checkoutHref: string | null;
  highlighted?: boolean;
  features: PricingFeature[];
}

export const PRICING_TIERS: PricingTier[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    per: "forever",
    desc: "Everything you need to start dueling.",
    cta: "Current plan",
    ctaVariant: "outline",
    checkoutHref: null,
    features: [
      { icon: "check", text: "Unlimited online matches" },
      { icon: "check", text: "3 AI difficulties" },
      { icon: "check", text: "Basic match history" },
      { icon: "check", text: "1 hint per game" },
      { icon: "x", text: "AI Coach insights" },
      { icon: "x", text: "Custom chip skins" },
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$4",
    per: "per month",
    desc: "For players sharpening their game daily.",
    cta: "Start Pro · 7-day free",
    ctaVariant: "primary",
    checkoutHref: "/api/stripe/checkout?price=pro_monthly",
    highlighted: true,
    features: [
      { icon: "check", text: "Everything in Free, plus" },
      { icon: "spark", text: "Unlimited best-move hints" },
      { icon: "spark", text: "Full AI Coach with replays" },
      { icon: "spark", text: "All 4 AI difficulties + custom" },
      { icon: "spark", text: "8 chip skins · 3 board styles" },
      { icon: "spark", text: "Profile crown + Pro badge" },
    ],
  },
  {
    id: "team",
    name: "Team",
    price: "$12",
    per: "per month · 5 seats",
    desc: "For clubs, classrooms, and office leagues.",
    cta: "Talk to us",
    ctaVariant: "outline",
    checkoutHref: "/api/stripe/checkout?price=team_monthly",
    features: [
      { icon: "check", text: "Everything in Pro, plus" },
      { icon: "spark", text: "Private leagues + brackets" },
      { icon: "spark", text: "Centralized billing" },
      { icon: "spark", text: "Coach reports per member" },
      { icon: "spark", text: "Custom club URL" },
      { icon: "spark", text: "Priority support" },
    ],
  },
];

/** Annual Pro checkout link, advertised as "$36/year". */
export const PRO_YEARLY_HREF = "/api/stripe/checkout?price=pro_yearly";

export interface ComparisonRow {
  feature: string;
  free: string;
  pro: string;
  team: string;
}

export const PRICING_COMPARISON: ComparisonRow[] = [
  { feature: "Online ranked matches", free: "Unlimited", pro: "Unlimited", team: "Unlimited" },
  { feature: "AI hints per game", free: "1", pro: "∞", team: "∞" },
  { feature: "AI Coach postmatch", free: "—", pro: "Full", team: "Full + reports" },
  { feature: "Chip skins", free: "2", pro: "8", team: "Custom" },
  { feature: "Board themes", free: "1", pro: "3", team: "Custom" },
  { feature: "Match history depth", free: "30 days", pro: "All-time", team: "All-time" },
  { feature: "Private leagues", free: "—", pro: "—", team: "Yes" },
];

export interface PricingFaq {
  q: string;
  a: string;
}

export const PRICING_FAQ: PricingFaq[] = [
  { q: "Can I cancel anytime?", a: "Yes. Cancel from Settings in two clicks. You keep Pro until the end of your billing cycle." },
  { q: "Do hints affect my ELO?", a: "Hints are unavailable in Ranked. Use them in Solo, Duels, and Daily Puzzles." },
  { q: "Is there a yearly plan?", a: "$36/year — three months free vs monthly. Same features." },
  { q: "What happens to my data if I downgrade?", a: "Nothing. Your match history, ELO and achievements stay intact." },
];

// ─── Daily puzzle (landing / shared) ─────────────────────────────────────────

export interface DailyPuzzle {
  number: number;
  title: string;
  blurb: string;
  solvedToday: number;
}

export const DAILY_PUZZLE: DailyPuzzle = {
  number: 142,
  title: "White to win in 3.",
  blurb: "Find the only forcing line.",
  solvedToday: 312,
};
