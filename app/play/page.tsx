import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Nav } from "@/components/layout/Nav";
import { PlayLobby } from "./PlayLobby";
import styles from "./play.module.css";

export const metadata: Metadata = {
  title: "Play",
  description:
    "Pick your fight — drill against the AI, duel a friend by link, or find a ranked match.",
};

export default function PlayPage() {
  return (
    <>
      <Nav active="Play" />
      <main className={styles.main}>
        <PlayLobby />
      </main>
      <Footer />
      <MobileTabBar />
    </>
  );
}
