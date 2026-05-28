import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Nav } from "@/components/layout/Nav";
import { Chip, Icon } from "@/components/ui";
import { PRICING_COMPARISON, PRICING_FAQ, PRICING_TIERS } from "@/lib/mockData";
import { PricingPlans } from "./PricingPlans";
import styles from "./pricing.module.css";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Sharper game. Same four in a row. Free, Pro ($4/mo or $36/yr), and Team plans.",
};

export default function PricingPage() {
  return (
    <>
      <Nav active="Pricing" />
      <main className={styles.main}>
        <div className={styles.hero}>
          <Chip tone="gold" size="md" icon={<Icon name="crown" size={11} />}>
            Drop4 Pro
          </Chip>
          <h1 className={styles.title}>
            Sharper game.
            <br />
            <span className={styles.dim}>Same four in a row.</span>
          </h1>
          <p className={styles.sub}>
            Pro unlocks unlimited coach hints, deeper postmatch analysis, custom chip skins, and a
            tiny crown next to your name.
          </p>
        </div>

        <PricingPlans tiers={PRICING_TIERS} />

        {/* Feature comparison */}
        <div className={styles.compareWrap}>
          <h2 className={styles.h2}>Compare features</h2>
          <div className={styles.compare}>
            <div className={`${styles.compareRow} ${styles.compareHead}`}>
              <span>Feature</span>
              <span>Free</span>
              <span className={styles.coral}>Pro</span>
              <span>Team</span>
            </div>
            {PRICING_COMPARISON.map((row, i) => (
              <div
                key={row.feature}
                className={[styles.compareRow, i % 2 === 1 && styles.zebra].filter(Boolean).join(" ")}
              >
                <span className={styles.featName}>{row.feature}</span>
                <span className={cellClass(row.free, styles)}>{row.free}</span>
                <span className={`${cellClass(row.pro, styles)} ${styles.proCell}`}>{row.pro}</span>
                <span className={cellClass(row.team, styles)}>{row.team}</span>
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className={styles.faqWrap}>
          <h2 className={styles.h2}>Common questions</h2>
          <div className={styles.faqList}>
            {PRICING_FAQ.map((f) => (
              <details key={f.q} className={styles.faq}>
                <summary className={styles.faqSummary}>
                  {f.q}
                  <span className={styles.faqMark} aria-hidden="true">
                    +
                  </span>
                </summary>
                <p className={styles.faqAnswer}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </main>

      <Footer />
      <MobileTabBar />
    </>
  );
}

function cellClass(
  value: string,
  s: Record<string, string>,
): string {
  // Numeric / symbol values use mono; em-dash and prose use sans.
  return value === "—" ? s.cellSans : `${s.cellMono} mono`;
}
