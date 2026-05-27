"use client";

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import styles from "./GameControls.module.css";

export interface GameControlsProps {
  /** Whether the game has ended (switches the rail to the won/draw layout). */
  finished: boolean;
  /** PRO unlocks the hint button without the gold lock. */
  isPro?: boolean;

  // ── Playing state ──
  /** Hints remaining (Infinity for PRO). Renders the gold PRO lock at 0. */
  hintsLeft: number;
  /** Threat reveals remaining (Infinity for PRO). */
  threatsLeft: number;
  /** Total threat budget (for the "n/3" display). */
  threatsBudget: number;
  /** Whether the threat overlay is currently on. */
  threatsOn: boolean;
  /** "Move 11 · 0:42 elapsed" string (caller-formatted, mono). */
  statusLabel: string;
  /** Whether interactive (human's turn, game live). */
  busy?: boolean;
  onHint?: () => void;
  onToggleThreats?: () => void;

  // ── Won / draw state ──
  onRematch?: () => void;
  onOpenCoach?: () => void;
  onShare?: () => void;
  /** Label for the rematch action ("Rematch" / "Next game" / "New series"). */
  rematchLabel?: string;
}

export function GameControls({
  finished,
  isPro = false,
  hintsLeft,
  threatsLeft,
  threatsBudget,
  threatsOn,
  statusLabel,
  busy = false,
  onHint,
  onToggleThreats,
  onRematch,
  onOpenCoach,
  onShare,
  rematchLabel = "Rematch",
}: GameControlsProps) {
  if (finished) {
    return (
      <div className={styles.rail} data-finished>
        <Button
          variant="outline"
          size="md"
          icon={<Icon name="refresh" size={13} />}
          onClick={onRematch}
        >
          {rematchLabel}
        </Button>
        <Button
          variant="primary"
          size="md"
          iconRight={<Icon name="chevR" size={13} />}
          onClick={onOpenCoach}
        >
          Open AI Coach
        </Button>
        <Button
          variant="ghost"
          size="md"
          icon={<Icon name="share" size={13} />}
          onClick={onShare}
        >
          Share win
        </Button>
      </div>
    );
  }

  const hintLocked = !isPro && hintsLeft <= 0;
  const threatBudgetText = isPro
    ? "∞"
    : `${Math.max(0, threatsLeft)}/${threatsBudget}`;
  const threatsExhausted = !isPro && !threatsOn && threatsLeft <= 0;

  return (
    <div className={styles.rail}>
      <Button
        variant="outline"
        size="md"
        icon={<Icon name="bolt" size={13} color="var(--gold)" />}
        onClick={onHint}
        disabled={busy}
        aria-label={hintLocked ? "Best move (PRO)" : "Show best move"}
      >
        <span>Best move</span>
        {hintLocked ? (
          <span className={styles.proTag}>
            <Icon name="lock" size={9} /> PRO
          </span>
        ) : !isPro ? (
          <span className={`${styles.budget} mono`}>{hintsLeft}</span>
        ) : null}
      </Button>

      <Button
        variant={threatsOn ? "secondary" : "ghost"}
        size="md"
        icon={<Icon name="eye" size={13} />}
        onClick={onToggleThreats}
        disabled={busy || threatsExhausted}
      >
        Show threats <span className={`${styles.budget} mono`}>({threatBudgetText})</span>
      </Button>

      <div className={styles.divider} />

      <span className={`${styles.status} mono`}>{statusLabel}</span>
    </div>
  );
}
