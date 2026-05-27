import type { ReactNode } from "react";
import styles from "./Chip.module.css";

export type ChipTone =
  | "neutral"
  | "coral"
  | "aqua"
  | "gold"
  | "success"
  | "danger"
  | "outline";
export type ChipSize = "sm" | "md" | "lg";

export interface ChipProps {
  children: ReactNode;
  tone?: ChipTone;
  size?: ChipSize;
  icon?: ReactNode;
  className?: string;
  title?: string;
}

export function Chip({
  children,
  tone = "neutral",
  size = "sm",
  icon,
  className,
  title,
}: ChipProps) {
  return (
    <span
      title={title}
      className={[styles.chip, styles[tone], styles[size], className]
        .filter(Boolean)
        .join(" ")}
    >
      {icon}
      {children}
    </span>
  );
}
