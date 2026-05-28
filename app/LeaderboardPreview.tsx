import { createClient } from "@/lib/supabase/server";
import { getLeaderboard } from "@/lib/db/queries";
import type { LeaderboardRow as CloudRow } from "@/types/database";
import {
  LeaderboardPreviewClient,
  type LbRow,
} from "./LeaderboardPreviewClient";

const SUPABASE_CONFIGURED = !!(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const CITY = "Almaty";

function formatDelta(n: number): string {
  if (n > 0) return `+${n}`;
  if (n < 0) return `−${Math.abs(n)}`;
  return "0";
}

function adapt(r: CloudRow, selfUsername: string | null): LbRow {
  return {
    rank: r.rank,
    username: r.username,
    name: r.display_name ?? r.username,
    elo: r.elo,
    delta: formatDelta(r.weekly_delta ?? 0),
    city: r.city ?? CITY,
    isSelf: selfUsername !== null && r.username === selfUsername,
  };
}

/**
 * Landing-page city leaderboard card. Fully server-rendered: fetches both
 * periods + the signed-in user's username (only non-anonymous users count)
 * before the first paint. No client-side data fetching and no mock fallback —
 * unsigned visitors used to see a hard-coded "tigran.dvk" row tagged "You",
 * which made the site look like it had silently created an account for them.
 */
export async function LeaderboardPreview() {
  if (!SUPABASE_CONFIGURED) {
    // Build/preview environments without backend config — render the empty
    // card rather than a fake roster so we never claim someone's identity.
    return <LeaderboardPreviewClient city={CITY} weekly={[]} alltime={[]} />;
  }

  const supabase = await createClient();

  // Identify the signed-in user for the "You" badge — but only if they're a
  // real account, never an anonymous-auth session.
  let selfUsername: string | null = null;
  try {
    const { data: userResp } = await supabase.auth.getUser();
    const user = userResp.user;
    if (user && !user.is_anonymous) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user.id)
        .maybeSingle();
      selfUsername = profile?.username ?? null;
    }
  } catch {
    selfUsername = null;
  }

  // Fetch both periods in parallel; tolerate either failing without breaking
  // the page.
  const [weeklyRaw, alltimeRaw] = await Promise.all([
    getLeaderboard(supabase, { city: CITY, period: "weekly" }).catch(() => []),
    getLeaderboard(supabase, { city: CITY, period: "alltime" }).catch(() => []),
  ]);

  const top = (rows: CloudRow[]) => rows.slice(0, 5).map((r) => adapt(r, selfUsername));

  return (
    <LeaderboardPreviewClient
      city={CITY}
      weekly={top(weeklyRaw)}
      alltime={top(alltimeRaw)}
    />
  );
}
