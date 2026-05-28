import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Nav } from "@/components/layout/Nav";
import styles from "./legal.module.css";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "How Drop4 collects, uses, and protects your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <article className={styles.doc}>
          <header className={styles.header}>
            <h1 className={styles.title}>Privacy Policy</h1>
            <p className={styles.updated}>Last updated: May 2026</p>
            <p className={styles.intro}>
              This policy explains what data Drop4 collects when you play, how we use it, and the
              choices you have. We aim to collect only what we need to run a fair, competitive
              Connect Four platform.
            </p>
          </header>

          <section className={styles.section}>
            <h2 className={styles.h2}>What we collect</h2>
            <p>When you create an account or play matches, we collect:</p>
            <ul className={styles.list}>
              <li>
                <strong>Account details</strong> — your email address and the username and display
                name you choose.
              </li>
              <li>
                <strong>Game data</strong> — match results, move histories, ELO rating, win/loss
                stats, and leaderboard standing.
              </li>
              <li>
                <strong>Preferences</strong> — your selected theme and music settings.
              </li>
            </ul>
            <p>
              We do not collect payment card numbers directly; subscription billing is handled by our
              payment processor (see below).
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>How we use your data</h2>
            <p>We use the data we collect to:</p>
            <ul className={styles.list}>
              <li>Run matches, matchmaking, and city leaderboards.</li>
              <li>Calculate ratings and surface postmatch and AI coach analysis.</li>
              <li>Maintain your account, manage Pro subscriptions, and provide support.</li>
              <li>Keep play fair by detecting abuse and protecting the integrity of rankings.</li>
            </ul>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Cookies and local storage</h2>
            <p>
              We use cookies and your browser&apos;s local storage to keep you signed in and to
              remember preferences such as your theme (light or dark) and whether background music is
              enabled. These are functional, not advertising, cookies. Clearing them will reset your
              preferences and may sign you out.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Service providers</h2>
            <p>
              We rely on trusted providers to operate Drop4. Account and game data are stored with
              Supabase, which acts as a data processor on our behalf. Subscription payments are
              processed by Stripe. These providers handle data only as needed to deliver their
              services to us and under their own security and privacy commitments.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Data retention and your choices</h2>
            <p>
              We keep your account and game data while your account is active. You can update your
              profile at any time, and you may request deletion of your account, after which we
              remove your personal data except where we are required to retain it.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Contact</h2>
            <p>
              Questions about this policy or your data? Reach us at{" "}
              <a className={styles.contact} href="mailto:privacy@drop4.gg">
                privacy@drop4.gg
              </a>
              .
            </p>
          </section>
        </article>
      </main>

      <Footer />
      <MobileTabBar />
    </>
  );
}
