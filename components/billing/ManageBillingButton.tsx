"use client";

/**
 * Opens the Stripe Billing Portal by POSTing to `/api/stripe/portal`. The route
 * replies with a 303 redirect to the portal (or back to /pricing with a flag if
 * the caller has no Stripe customer / Stripe is unconfigured); the browser
 * follows it natively.
 */
import { Button, type ButtonVariant, type ButtonSize } from "@/components/ui";
import type { ReactNode } from "react";

interface ManageBillingButtonProps {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
  icon?: ReactNode;
}

export function ManageBillingButton({
  children = "Manage billing",
  variant = "outline",
  size = "md",
  full,
  className,
  icon,
}: ManageBillingButtonProps) {
  return (
    <form action="/api/stripe/portal" method="post" className={className}>
      <Button type="submit" variant={variant} size={size} full={full} icon={icon}>
        {children}
      </Button>
    </form>
  );
}
