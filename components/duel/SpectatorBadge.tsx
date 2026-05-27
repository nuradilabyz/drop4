"use client";

/**
 * Small "Spectating" chip rendered over a duel board for read-only watchers,
 * plus an optional live spectator count for the players. Tokens only.
 */

import { Chip, Icon } from "@/components/ui";

export interface SpectatorBadgeProps {
  /** Number of watchers currently in the room (optional). */
  count?: number;
}

export function SpectatorBadge({ count }: SpectatorBadgeProps) {
  return (
    <Chip tone="aqua" size="md" icon={<Icon name="eye" size={12} />}>
      Spectating{count !== undefined && count > 0 ? ` · ${count}` : ""}
    </Chip>
  );
}

/** Compact watcher tally for the players' top bar / footer. */
export function SpectatorCount({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <Chip tone="neutral" size="sm" icon={<Icon name="eye" size={11} />}>
      <span className="mono">{count}</span> watching
    </Chip>
  );
}
