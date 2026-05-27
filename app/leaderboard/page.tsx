import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Nav } from "@/components/layout/Nav";
import { LeaderboardView } from "./LeaderboardView";
import styles from "./leaderboard.module.css";

export const metadata: Metadata = {
  title: "Leaderboard",
  description: "Live ELO across 64 cities. Resets monthly on the 1st.",
};

export default function LeaderboardPage() {
  return (
    <>
      <Nav active="Leaderboard" />
      <main className={styles.main}>
        <LeaderboardView />
      </main>
      <Footer />
      <MobileTabBar />
    </>
  );
}
