/**
 * Create a new duel room and redirect the host into it.
 *
 * GET /r/new
 *   1. Resolves the host identity: an existing server session if present,
 *      otherwise `signInAnonymously()` so every participant has a real uid.
 *   2. Generates a friendly slug (`adjective-animal-NN`, e.g. `frosty-otter-19`)
 *      and inserts a `duel_rooms` row with `status='open'`, host = the uid.
 *   3. Redirects 303 to `/r/<slug>`.
 *
 * If anonymous sign-in is disabled in the Supabase project, we still create the
 * room with `host_id = null` (claimed client-side via a localStorage guest id)
 * and redirect — the client `DuelRoom` reconciles ownership on load.
 *
 * Next.js 16: this is a route handler (no params to await here); `cookies()` is
 * awaited inside `createClient()`.
 */
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database";

export const runtime = "nodejs";
// Always run fresh — never cache a room-creation response.
export const dynamic = "force-dynamic";

const ADJECTIVES = [
  "frosty", "sunny", "brave", "swift", "lucky", "cosmic", "mellow", "vivid",
  "nimble", "golden", "silent", "rusty", "breezy", "stormy", "jolly", "amber",
  "crimson", "azure", "noble", "wild", "quiet", "fierce", "cobalt", "lunar",
];
const ANIMALS = [
  "otter", "falcon", "panda", "lynx", "heron", "marten", "tapir", "bison",
  "gecko", "raven", "moose", "ferret", "wombat", "puffin", "ocelot", "ibex",
  "narwhal", "manta", "viper", "badger", "stoat", "kestrel", "lemur", "quokka",
];

/** `frosty-otter-19` — short, pronounceable, URL-safe. */
function generateSlug(): string {
  const adj = ADJECTIVES[Math.floor(Math.random() * ADJECTIVES.length)];
  const animal = ANIMALS[Math.floor(Math.random() * ANIMALS.length)];
  const num = Math.floor(Math.random() * 90) + 10; // 10..99
  return `${adj}-${animal}-${num}`;
}

type DuelRoomInsert = Database["public"]["Tables"]["duel_rooms"]["Insert"];

export async function GET(request: NextRequest) {
  const { origin } = new URL(request.url);
  const supabase = await createClient();

  // ── Host identity: reuse the session or mint an anonymous one. ──
  let hostId: string | null = null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    hostId = user.id;
  } else {
    const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously();
    if (!anonErr && anon.user) {
      hostId = anon.user.id;
    }
    // If anon sign-in is disabled, hostId stays null; the client claims via a
    // localStorage guest id and the room is still playable (casual only).
  }

  // ── Create the room with a unique slug (retry on the unlikely PK clash). ──
  let slug = "";
  let lastError: string | null = null;
  for (let attempt = 0; attempt < 6; attempt++) {
    const candidate = generateSlug();
    const row: DuelRoomInsert = {
      slug: candidate,
      host_id: hostId,
      status: "open",
      last_activity_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("duel_rooms").insert(row);
    if (!error) {
      slug = candidate;
      break;
    }
    lastError = error.message;
    // 23505 = unique_violation (slug collision) → try a new slug.
    if (error.code !== "23505") break;
  }

  if (!slug) {
    // Backend unreachable / not yet configured (or anon sign-in + insert both
    // failed). Don't dump raw JSON on a primary CTA — bounce back to the lobby
    // with a flag so it can show a friendly "try again shortly" toast.
    console.error("[/r/new] room creation failed:", lastError);
    return NextResponse.redirect(`${origin}/play?duel=unavailable`, {
      status: 303,
    });
  }

  // 303 so the browser follows with a GET to the room page.
  return NextResponse.redirect(`${origin}/r/${slug}`, { status: 303 });
}
