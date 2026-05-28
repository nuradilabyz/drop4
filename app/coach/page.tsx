import type { Metadata } from "next";
import { Nav } from "@/components/layout/Nav";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { CoachIndex } from "./CoachIndex";
import styles from "./coach-index.module.css";

/**
 * Bare /coach landing — there's nothing to analyze without a match ID, but
 * typing /coach into the URL bar (or following a stale link) shouldn't dead-end
 * on Next's default 404. This page lists the finished games stored in
 * localStorage so the user can pick one, and shows a friendly empty state when
 * there are none. The real analysis lives at /coach/[matchId].
 */
export const metadata: Metadata = {
  title: "AI Coach",
  description:
    "Pick a finished game to break it down move-by-move with the AI coach.",
};

export default function CoachIndexPage() {
  return (
    <>
      <Nav active="Coach" />
      <main className={styles.main}>
        <header className={styles.head}>
          <div className={styles.kicker}>AI Coach</div>
          <h1 className={styles.title}>Pick a game to break down.</h1>
          <p className={styles.sub}>
            Every finished match gets a move-by-move analysis — accuracy %,
            blunders, missed threats, and what the coach saw at the critical
            moments. Pick one from your local history below.
          </p>
        </header>
        <CoachIndex />
      </main>
      <Footer />
      <MobileTabBar />
    </>
  );
}
