import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import styles from "./Button.module.css";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "coral"
  | "outline";
export type ButtonSize = "sm" | "md" | "lg" | "xl";

interface CommonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  iconRight?: ReactNode;
  full?: boolean;
  loading?: boolean;
  className?: string;
  children?: ReactNode;
}

type ButtonAsButton = CommonProps &
  Omit<ComponentProps<"button">, keyof CommonProps | "ref"> & {
    href?: undefined;
  };

type ButtonAsLink = CommonProps &
  Omit<ComponentProps<typeof Link>, keyof CommonProps | "ref"> & {
    href: ComponentProps<typeof Link>["href"];
  };

export type ButtonProps = ButtonAsButton | ButtonAsLink;

function cls(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

/**
 * The design's Button (tokens.jsx) with real interaction states. Renders an
 * <a> (Next Link) when given `href`, otherwise a <button>.
 */
export function Button(props: ButtonProps) {
  const {
    variant = "primary",
    size = "md",
    icon,
    iconRight,
    full,
    loading,
    className,
    children,
    ...rest
  } = props;

  const classNames = cls(
    styles.btn,
    styles[variant],
    styles[size],
    full && styles.full,
    className,
  );

  const content = (
    <>
      {loading ? <span className={styles.spinner} aria-hidden="true" /> : icon}
      {children}
      {iconRight}
    </>
  );

  if ("href" in rest && rest.href !== undefined) {
    const { href, ...linkRest } = rest as ButtonAsLink;
    return (
      <Link href={href} className={classNames} {...linkRest}>
        {content}
      </Link>
    );
  }

  const { disabled, ...btnRest } = rest as ButtonAsButton;
  return (
    <button
      className={classNames}
      disabled={disabled || loading}
      {...btnRest}
    >
      {content}
    </button>
  );
}
