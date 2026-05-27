import { Icon } from "@/components/ui/Icon";
import type { Player } from "@/engine/types";
import styles from "./WinBanner.module.css";

export interface WinBannerProps {
  /** The winner's chip, or null for a draw. */
  winner: Player | null;
  /** Whether the local human won (controls "You won" vs name). */
  youWon?: boolean;
  /** e.g. "the diagonal" / "row 3" — appended after "connected 4 on". */
  lineLabel?: string;
  /** Name of the winner when it isn't you (e.g. "Hard AI"). */
  winnerName?: string;
}

/**
 * Floating banner above the board after a game ends (game.jsx "won" state).
 * Pill-shaped, drops in with a fade-up. Shows a draw variant when no winner.
 */
export function WinBanner({
  winner,
  youWon = false,
  lineLabel = "the board",
  winnerName,
}: WinBannerProps) {
  const draw = winner === null;
  const label = draw
    ? "Draw — the board filled up"
    : youWon
      ? `You won — connected 4 on ${lineLabel}`
      : `${winnerName ?? "Opponent"} won — connected 4 on ${lineLabel}`;

  return (
    <div className={styles.banner} role="status" data-draw={draw}>
      <Icon
        name={draw ? "target" : "cup"}
        size={14}
        color={
          draw
            ? "var(--text-mute)"
            : winner === "c"
              ? "var(--coral)"
              : "var(--aqua)"
        }
      />
      <span>{label}</span>
    </div>
  );
}
