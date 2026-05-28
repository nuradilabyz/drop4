"use client";

/**
 * Profile-header share button. Tries the native share sheet first (iOS
 * Safari, Android Chrome, modern desktops) and falls back to clipboard
 * for anything that doesn't expose `navigator.share`. Either path ends
 * with a transient confirmation toast so the user knows it worked.
 *
 * The page that renders this hands us a relative path (`/profile/<u>`);
 * we resolve it to an absolute URL on the client at click time so it
 * works on previews, branchAliases, or whatever host the user is on.
 */

import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { Toast, useToast } from "@/components/ui/Toast";

export interface ShareProfileButtonProps {
  /** Same-origin path of the profile, e.g. `/profile/aigerim`. */
  path: string;
  /** Display name used in the native share sheet title. */
  displayName: string;
}

export function ShareProfileButton({ path, displayName }: ShareProfileButtonProps) {
  const { message, show } = useToast(1800);

  async function onShare() {
    const url = `${window.location.origin}${path}`;
    const shareData = { title: `${displayName} on Drop4`, url };

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      try {
        await navigator.share(shareData);
        return;
      } catch {
        // Native sheet was opened and dismissed — treat as a no-op, not a
        // failure. The user already saw the sheet so no toast needed.
        return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      show("Profile link copied");
    } catch {
      show("Couldn't copy — long-press the URL bar instead");
    }
  }

  return (
    <>
      <Button
        variant="outline"
        size="md"
        onClick={onShare}
        icon={<Icon name="share" size={13} />}
      >
        Share profile
      </Button>
      <Toast message={message} />
    </>
  );
}
