"use client";

/**
 * Client island for the pricing plans grid.
 *
 * Holds the monthly/yearly billing-period toggle. Only the Pro tier reacts to
 * it: in "yearly" mode the Pro card swaps to its `tier.yearly` price/per/CTA
 * (→ pro_yearly checkout) and shows a savings badge. Free and Team are static.
 *
 * The hero, comparison table, and FAQ stay in the server page — they don't need
 * any client state, so only this grid is hydrated.
 */
import { useState } from "react";
import { Icon } from "@/components/ui";
import type { PricingTier } from "@/lib/mockData";
import styles from "./pricing.module.css";

type BillingPeriod = "monthly" | "yearly";

const PERIODS: { id: BillingPeriod; label: string }[] = [
  { id: "monthly", label: "Monthly" },
  { id: "yearly", label: "Yearly" },
];

export function PricingPlans({ tiers }: { tiers: PricingTier[] }) {
  const [period, setPeriod] = useState<BillingPeriod>("monthly");

  return (
    <>
      <div className={styles.billingToggle} role="group" aria-label="Billing period">
        {PERIODS.map((p) => {
          const active = p.id === period;
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={active}
              onClick={() => setPeriod(p.id)}
              className={[styles.billingOption, active && styles.billingOptionActive]
                .filter(Boolean)
                .join(" ")}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      <div className={styles.plans}>
        {tiers.map((tier) => (
          <PlanCard key={tier.id} tier={tier} period={period} />
        ))}
      </div>
    </>
  );
}

function PlanCard({ tier, period }: { tier: PricingTier; period: BillingPeriod }) {
  const { highlighted } = tier;

  // Only tiers with a `yearly` alternative respond to the toggle (Pro today).
  const useYearly = period === "yearly" && tier.yearly !== undefined;
  const price = useYearly ? tier.yearly!.price : tier.price;
  const per = useYearly ? tier.yearly!.per : tier.per;
  const checkoutHref = useYearly ? tier.yearly!.checkoutHref : tier.checkoutHref;
  const savings = useYearly ? tier.yearly!.savings : undefined;

  const cta =
    checkoutHref !== null ? (
      <a
        href={checkoutHref}
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
        <span className={`${styles.price} mono`}>{price}</span>
        <span className={styles.per}>{per}</span>
        {savings && <span className={styles.savingsBadge}>{savings}</span>}
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
