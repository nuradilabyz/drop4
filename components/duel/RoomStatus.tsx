"use client";

/**
 * Full-bleed status panel for the terminal duel states: `closed` (idle timeout),
 * `error` (missing room / connection failure), or `connecting` (initial spinner).
 * Offers a way back to the lobby and, for closed rooms, a fresh "Create a new
 * room" CTA → `/r/new`.
 */

import { Button, Card, Icon, Logo } from "@/components/ui";
import styles from "./duel.module.css";

export type RoomStatusKind = "connecting" | "closed" | "error";

export interface RoomStatusProps {
  kind: RoomStatusKind;
  /** Human-readable detail. */
  message?: string | null;
}

const COPY: Record<RoomStatusKind, { title: string; icon: "x" | "flag" | "link" }> = {
  connecting: { title: "Connecting to the room…", icon: "link" },
  closed: { title: "Room closed (idle)", icon: "flag" },
  error: { title: "Room unavailable", icon: "x" },
};

export function RoomStatus({ kind, message }: RoomStatusProps) {
  const { title, icon } = COPY[kind];

  return (
    <div className={styles.statusWrap}>
      <Card className={styles.statusCard} padded>
        <div className={styles.waitKicker}>
          <Logo size={20} />
          <span>Duel room</span>
        </div>

        {kind === "connecting" ? (
          <div className={styles.spinner} aria-hidden="true" />
        ) : (
          <div className={styles.statusIcon} data-kind={kind} aria-hidden="true">
            <Icon name={icon} size={22} />
          </div>
        )}

        <h1 className={styles.statusTitle}>{title}</h1>
        {message && <p className={styles.waitBody}>{message}</p>}

        {kind !== "connecting" && (
          <div className={styles.statusActions}>
            <Button
              variant="secondary"
              size="md"
              icon={<Icon name="link" size={13} />}
              href="/r/new"
            >
              Create a new room
            </Button>
            <Button
              variant="ghost"
              size="md"
              icon={<Icon name="home" size={13} />}
              href="/play"
            >
              Back to lobby
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
