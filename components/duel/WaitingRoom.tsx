"use client";

/**
 * Waiting-room surface shown to the host while a duel room is `open` and no
 * guest has joined. Mirrors the lobby Duel card (screens/lobby.jsx): the
 * shareable `drop4.gg/r/<slug>` link with a copy button, a "waiting for
 * opponent…" line with presence dots, and the "Room closes after 10 min idle"
 * note (here a live countdown).
 *
 * Presentational only — copy + countdown state come from `DuelRoom` via props.
 */

import { useState } from "react";
import { Button, Card, Icon, Logo } from "@/components/ui";
import styles from "./duel.module.css";

export interface WaitingRoomProps {
  /** Full shareable URL, e.g. "https://drop4.gg/r/frosty-otter-19". */
  shareUrl: string;
  /** The slug only, for the styled "drop4.gg/r/<slug>" display. */
  slug: string;
  /** ms left before idle close — rendered as "m:ss". */
  idleMsLeft: number;
  /** Whether the opponent's presence has appeared (about to start). */
  opponentJoining?: boolean;
}

function fmt(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function WaitingRoom({
  shareUrl,
  slug,
  idleMsLeft,
  opponentJoining = false,
}: WaitingRoomProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(shareUrl || `drop4.gg/r/${slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard blocked — the URL is still visible to copy manually */
    }
  };

  return (
    <div className={styles.waitWrap}>
      <Card className={styles.waitCard} padded>
        <div className={styles.waitKicker}>
          <Logo size={20} />
          <span>Duel room</span>
        </div>

        <h1 className={styles.waitTitle}>Share this link</h1>
        <p className={styles.waitBody}>
          Send it to a friend. The duel starts the moment they open it — any
          device, no account needed.
        </p>

        <div className={`${styles.linkBox} mono`}>
          <span className={styles.linkText}>
            <span className={styles.linkMute}>drop4.gg/r/</span>
            <span className={styles.linkSlug}>{slug}</span>
          </span>
          <button
            type="button"
            className={styles.copyBtn}
            onClick={copy}
            aria-label="Copy room link"
          >
            <Icon name={copied ? "check" : "copy"} size={14} />
          </button>
        </div>

        <Button
          variant="secondary"
          size="lg"
          full
          icon={<Icon name={copied ? "check" : "link"} size={14} />}
          onClick={copy}
        >
          {copied ? "Link copied" : "Copy room link"}
        </Button>

        <div
          className={styles.waitStatus}
          data-joining={opponentJoining || undefined}
        >
          <span className={styles.dots} aria-hidden="true">
            <span className={styles.dot} />
            <span className={styles.dot} />
            <span className={styles.dot} />
          </span>
          {opponentJoining ? "Opponent joining…" : "Waiting for opponent…"}
        </div>

        <div className={styles.waitNote}>
          Room closes after 10 min idle ·{" "}
          <span className="mono">{fmt(idleMsLeft)}</span> left
        </div>
      </Card>
    </div>
  );
}
