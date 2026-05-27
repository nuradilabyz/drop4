import type { ComponentProps, ReactNode } from "react";
import styles from "./Card.module.css";

export interface CardProps extends ComponentProps<"div"> {
  children: ReactNode;
  padded?: boolean;
  interactive?: boolean;
}

export function Card({
  children,
  padded = true,
  interactive = false,
  className,
  ...rest
}: CardProps) {
  return (
    <div
      className={[
        styles.card,
        padded && styles.padded,
        interactive && styles.interactive,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </div>
  );
}
