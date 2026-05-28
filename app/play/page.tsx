import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Nav } from "@/components/layout/Nav";
import { createClient } from "@/lib/supabase/server";
import { PlayLobby } from "./PlayLobby";
import styles from "./play.module.css";

export const metadata: Metadata = {
  title: "Play",
  description:
    "Pick your fight — drill against the AI, duel a friend by link, or find a ranked match.",
};

export default async function PlayPage() {
  // Resolve the viewer's real profile Elo so the Ranked tile can show it
  // honestly. Falls back to null when the user is signed out, has no profile
  // row, or Supabase isn't configured — the tile handles that case.
  let userElo: number | null = null;
  try {
    const supabase = await createClient();
    const { data: auth } = await supabase.auth.getUser();
    if (auth.user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("elo")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (profile && typeof profile.elo === "number") {
        userElo = profile.elo;
      }
    }
  } catch {
    // Supabase unavailable — render the lobby without the user's Elo.
  }

  return (
    <>
      <Nav active="Play" />
      <main className={styles.main}>
        <PlayLobby initialUserElo={userElo} />
      </main>
      <Footer />
      <MobileTabBar />
    </>
  );
}
