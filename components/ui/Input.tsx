import type { ComponentProps, ReactNode } from "react";
import styles from "./Input.module.css";

export interface InputProps extends Omit<ComponentProps<"input">, "size"> {
  /** Leading adornment (icon or label) rendered inside the field. */
  lead?: ReactNode;
  /** Trailing slot — typically an embedded Button (e.g. copy / join). */
  trailing?: ReactNode;
  wrapClassName?: string;
}

/** Monospace input with optional leading icon and trailing action (tokens.jsx pattern). */
export function Input({ lead, trailing, wrapClassName, className, ...rest }: InputProps) {
  return (
    <div className={[styles.wrap, wrapClassName].filter(Boolean).join(" ")}>
      {lead && <span className={styles.lead}>{lead}</span>}
      <input className={[styles.input, className].filter(Boolean).join(" ")} {...rest} />
      {trailing}
    </div>
  );
}
