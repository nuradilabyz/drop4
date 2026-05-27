import type { Metadata } from "next";
import { Footer } from "@/components/layout/Footer";
import { MobileTabBar } from "@/components/layout/MobileTabBar";
import { Nav } from "@/components/layout/Nav";
import { Chip, Icon } from "@/components/ui";
import {
  PRICING_COMPARISON,
  PRICING_FAQ,
  PRICING_TIERS,
  type PricingTier,
} from "@/lib/mockData";
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

        <div className={styles.plans}>
          {PRICING_TIERS.map((tier) => (
            <PlanCard key={tier.id} tier={tier} />
          ))}
        </div>

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

function PlanCard({ tier }: { tier: PricingTier }) {
  const { highlighted } = tier;
  // TODO: wire to Stripe checkout — the billing agent builds /api/stripe/checkout.
  const cta =
    tier.checkoutHref !== null ? (
      <a
        href={tier.checkoutHref}
        className={[styles.cta, tier.ctaVariant === "primary" ? styles.ctaPrimary : styles.ctaOutline]
          .filter(Boolean)
          .join(" ")}
      >
        {tier.cta}
      </a>
    ) : (
      <button
        type="button"
        disabled
        className={[styles.cta, styles.ctaOutline, styles.ctaDisabled].join(" ")}
      >
        {tier.cta}
      </button>
    );

  return (
    <div className={[styles.plan, highlighted && styles.planHi].filter(Boolean).join(" ")}>
      {highlighted && <span className={styles.popular}>Most popular</span>}
      <div className={styles.planName}>{tier.name}</div>
      <div className={styles.priceRow}>
        <span className={`${styles.price} mono`}>{tier.price}</span>
        <span className={styles.per}>{tier.per}</span>
      </div>
      <p className={styles.planDesc}>{tier.desc}</p>
      <div className={styles.featureList}>
        {tier.features.map((f) => (
          <div key={f.text} className={styles.featureItem}>
            <span
              className={[
                styles.bullet,
                f.icon === "spark" && styles.bulletSpark,
                f.icon === "x" && styles.bulletX,
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <Icon name={f.icon === "x" ? "x" : "check"} size={10} stroke={2.4} />
            </span>
            <span className={f.icon === "x" ? styles.featXText : undefined}>{f.text}</span>
          </div>
        ))}
      </div>
      {cta}
    </div>
  );
}
