"use client";

/**
 * Starts a Stripe Checkout for a given price by POSTing to
 * `/api/stripe/checkout?price=...`. The route replies with a 303 redirect to
 * Stripe's hosted page (or back to /pricing with a flag if unconfigured), and
 * the browser follows it natively — no client fetch/JSON needed.
 *
 * Renders the shared `Button` primitive so it inherits the design system.
 */
import { Button, type ButtonVariant, type ButtonSize } from "@/components/ui";
import type { ReactNode } from "react";

export type CheckoutPrice = "pro_monthly" | "pro_yearly" | "team_monthly";

interface CheckoutButtonProps {
  price: CheckoutPrice;
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
  icon?: ReactNode;
}

export function CheckoutButton({
  price,
  children,
  variant = "primary",
  size = "md",
  full,
  className,
  icon,
}: CheckoutButtonProps) {
  // A native form POST means the server's 303 redirect (to Stripe) is followed
  // by the browser automatically, even with JS disabled.
  return (
    <form action={`/api/stripe/checkout?price=${price}`} method="post" className={className}>
      <Button type="submit" variant={variant} size={size} full={full} icon={icon}>
        {children}
      </Button>
    </form>
  );
}
