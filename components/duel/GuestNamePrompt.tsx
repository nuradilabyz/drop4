"use client";

/**
 * Pre-room name picker. Anyone who lands on `/r/<slug>` without a
 * resolved display name (anonymous-auth guest, a friend who's never
 * signed in, a host who skipped account setup) hits this screen first
 * — the host needs SOMETHING to render in the opponent pane besides
 * the literal "Guest". The chosen name is persisted in localStorage
 * by the caller so refresh / rejoin doesn't re-prompt.
 */

import { useState } from "react";
import { Button, Card, Icon, Input, Logo } from "@/components/ui";
import styles from "./duel.module.css";

export interface GuestNamePromptProps {
  onSubmit: (name: string) => void;
}

const NAME_MIN = 2;
const NAME_MAX = 24;

export function GuestNamePrompt({ onSubmit }: GuestNamePromptProps) {
  const [name, setName] = useState("");
  const trimmed = name.trim();
  const valid = trimmed.length >= NAME_MIN && trimmed.length <= NAME_MAX;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSubmit(trimmed);
  }

  return (
    <div className={styles.statusWrap}>
      <Card className={styles.statusCard} padded>
        <div className={styles.waitKicker}>
          <Logo size={20} />
          <span>Duel room</span>
        </div>

        <h1 className={styles.statusTitle}>What&apos;s your name?</h1>
        <p className={styles.waitBody}>
          Your opponent will see this in the duel header. Pick whatever
          you want them to call you.
        </p>

        <form className={styles.nameForm} onSubmit={submit}>
          <Input
            type="text"
            required
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Aigerim"
            maxLength={NAME_MAX}
            lead={<Icon name="user" size={14} />}
          />
          <Button
            type="submit"
            variant="coral"
            size="lg"
            full
            disabled={!valid}
            iconRight={<Icon name="arrow" size={15} />}
          >
            Join duel
          </Button>
        </form>
      </Card>
    </div>
  );
}
