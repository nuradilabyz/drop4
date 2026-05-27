import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import { SoundToggle } from "@/components/SoundToggle";
import styles from "./GameTopBar.module.css";

export interface GameTopBarProps {
  /** e.g. "Ranked · Best of 5" or "Solo · Hard AI". */
  modeLabel: string;
  onResign?: () => void;
  onSettings?: () => void;
  onShare?: () => void;
  /** Hide resign (e.g. after the game ends). */
  canResign?: boolean;
}

export function GameTopBar({
  modeLabel,
  onResign,
  onSettings,
  onShare,
  canResign = true,
}: GameTopBarProps) {
  return (
    <div className={styles.bar}>
      <div className={styles.left}>
        <Link href="/play" aria-label="Back to lobby">
          <Logo size={20} />
        </Link>
        <span className={styles.slash}>/</span>
        <div className={styles.mode}>
          <Icon name="bolt" size={12} color="var(--gold)" />
          <span>{modeLabel}</span>
        </div>
      </div>
      <div className={styles.right}>
        {canResign && (
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon name="flag" size={13} />}
            onClick={onResign}
          >
            Resign
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon name="settings" size={13} />}
          aria-label="Settings"
          onClick={onSettings}
        />
        <SoundToggle size={30} />
        <div className={styles.divider} />
        <Button
          variant="secondary"
          size="sm"
          icon={<Icon name="share" size={13} />}
          onClick={onShare}
        >
          Share
        </Button>
      </div>
    </div>
  );
}
