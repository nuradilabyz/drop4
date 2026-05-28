import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Nav } from "@/components/layout/Nav";
import styles from "../privacy/legal.module.css";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "The terms that govern your use of Drop4.",
};

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className={styles.main}>
        <article className={styles.doc}>
          <header className={styles.header}>
            <h1 className={styles.title}>Terms of Service</h1>
            <p className={styles.updated}>Last updated: May 2026</p>
            <p className={styles.intro}>
              These terms govern your use of Drop4, our competitive Connect Four platform. By playing
              or creating an account, you agree to them.
            </p>
          </header>

          <section className={styles.section}>
            <h2 className={styles.h2}>Acceptance</h2>
            <p>
              By accessing Drop4, creating an account, or playing a match, you agree to be bound by
              these terms. If you do not agree, please do not use the service.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Your account</h2>
            <p>
              You are responsible for keeping your login credentials secure and for activity that
              happens under your account. Choose a username and display name that do not impersonate
              others or infringe anyone&apos;s rights. You must be old enough to form a binding
              agreement in your jurisdiction to hold an account.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Acceptable use</h2>
            <p>To keep play fair and welcoming, you agree not to:</p>
            <ul className={styles.list}>
              <li>Cheat, use bots or external assistance in rated play, or manipulate ratings.</li>
              <li>Harass other players or post abusive, illegal, or infringing content.</li>
              <li>Attempt to disrupt, reverse engineer, or gain unauthorized access to the service.</li>
            </ul>
            <p>
              We may suspend or terminate accounts that violate these rules or undermine the
              integrity of the leaderboards.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Pro subscriptions and billing</h2>
            <p>
              Drop4 Pro is a paid subscription billed monthly or annually through our payment
              processor, Stripe. By subscribing, you authorize recurring charges until you cancel.
              You can cancel at any time, and access continues until the end of the current billing
              period. Except where required by law, payments are non-refundable. Prices may change
              with advance notice for future billing periods.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Disclaimers and liability</h2>
            <p>
              Drop4 is provided on an &quot;as is&quot; and &quot;as available&quot; basis without
              warranties of any kind. We do not guarantee uninterrupted or error-free service,
              including AI coach suggestions, which are provided for guidance only. To the extent
              permitted by law, Drop4 Labs is not liable for indirect or consequential damages
              arising from your use of the service.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Changes to these terms</h2>
            <p>
              We may update these terms from time to time. When we make material changes, we will
              update the date above and, where appropriate, notify you. Continuing to use Drop4 after
              changes take effect means you accept the revised terms.
            </p>
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Contact</h2>
            <p>
              Questions about these terms? Reach us at{" "}
              <a className={styles.contact} href="mailto:support@drop4.gg">
                support@drop4.gg
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
