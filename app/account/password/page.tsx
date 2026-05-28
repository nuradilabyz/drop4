"use client";

/**
 * Set password (+ display name on first visit). Reached after the
 * `/auth/callback` exchange — at that point Supabase has handed us a
 * session authorized to update the user. We treat this page as the
 * single "finish setting up your account" surface:
 *   - First visit (display_name still null) → also prompt for a name.
 *   - Recovery flow (existing user with display_name) → password only.
 *
 * The user told us they hated seeing other players show up as "Host" /
 * "Guest" or as a random username derived from their email. The
 * display_name set here is what every duel-room header, leaderboard
 * row, and profile page renders from then on.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import styles from "../../login/login.module.css";

type Status = "idle" | "submitting" | "success" | "error";

interface Rule {
  label: string;
  test: (pw: string) => boolean;
}
const RULES: Rule[] = [
  { label: "At least 8 characters", test: (p) => p.length >= 8 },
  { label: "One lowercase letter (a–z)", test: (p) => /[a-z]/.test(p) },
  { label: "One uppercase letter (A–Z)", test: (p) => /[A-Z]/.test(p) },
  { label: "One digit (0–9)", test: (p) => /\d/.test(p) },
];

const NAME_MIN = 2;
const NAME_MAX = 24;

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [needsName, setNeedsName] = useState<boolean | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // Guard the form + decide whether to show the name field. If the user
  // already has a display_name (recovery flow on an established account)
  // we keep the page focused on the password — pestering them for a
  // name they already chose would be annoying.
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (!mounted) return;
      if (error || !data.user) {
        setHasSession(false);
        return;
      }
      setHasSession(true);
      setUserId(data.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", data.user.id)
        .maybeSingle();
      if (!mounted) return;
      setNeedsName(!profile?.display_name);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const ruleStates = useMemo(() => RULES.map((r) => r.test(password)), [password]);
  const allRulesMet = ruleStates.every(Boolean);
  const trimmedName = displayName.trim();
  const nameOk = trimmedName.length >= NAME_MIN && trimmedName.length <= NAME_MAX;
  const canSubmit = allRulesMet && (!needsName || nameOk);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allRulesMet) {
      setError("Your password doesn't meet the requirements below.");
      setStatus("error");
      return;
    }
    if (needsName && !nameOk) {
      setError(
        `Pick a display name between ${NAME_MIN} and ${NAME_MAX} characters.`,
      );
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setError(null);
    const supabase = createClient();

    const updateData: { password: string; data?: { display_name: string } } = {
      password,
    };
    if (needsName) updateData.data = { display_name: trimmedName };

    const { error: updateErr } = await supabase.auth.updateUser(updateData);
    if (updateErr) {
      setError(updateErr.message);
      setStatus("error");
      return;
    }

    // Mirror display_name onto the public profiles row so server-rendered
    // surfaces (Nav, leaderboard, duel header) see it without waiting on
    // a webhook. RLS allows users to update their own row.
    if (needsName && userId) {
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ display_name: trimmedName })
        .eq("id", userId);
      if (profileErr) {
        // Non-fatal — the password updated. Surface a soft notice but still
        // proceed; the user can fix their name from the profile page later.
        console.warn("[account/password] profile sync failed", profileErr);
      }
    }

    setStatus("success");
    setTimeout(() => {
      window.location.href = "/";
    }, 900);
  }

  if (hasSession === false) {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.head}>
            <Logo size={26} />
            <h1 className={styles.title}>Link expired</h1>
            <p className={styles.sub}>
              This link is no longer valid. Sign in (or request a fresh reset)
              from the sign-in page.
            </p>
          </div>
          <Link href="/login" className={styles.back}>
            ← Back to sign in
          </Link>
        </div>
      </main>
    );
  }

  if (status === "success") {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.head}>
            <Logo size={26} />
            <h1 className={styles.title}>You&apos;re all set</h1>
            <p className={styles.sub}>Signing you in…</p>
          </div>
        </div>
      </main>
    );
  }

  const heading = needsName
    ? "Finish setting up your account"
    : "Choose a new password";
  const sub = needsName
    ? "Pick a display name your opponents will see, and a password you'll use to sign in next time."
    : "Pick something strong. You'll sign in with this from now on.";

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.head}>
          <Logo size={26} />
          <h1 className={styles.title}>{heading}</h1>
          <p className={styles.sub}>{sub}</p>
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          {needsName && (
            <Input
              type="text"
              required
              autoComplete="nickname"
              placeholder="Display name (e.g. Aigerim)"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={NAME_MAX}
              lead={<Icon name="user" size={14} />}
              autoFocus
            />
          )}

          <Input
            type="password"
            required
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            lead={<Icon name="lock" size={14} />}
            autoFocus={!needsName}
          />

          <ul className={styles.rules}>
            {RULES.map((r, i) => {
              const met = ruleStates[i];
              return (
                <li
                  key={r.label}
                  className={[styles.rule, met && styles.ruleMet]
                    .filter(Boolean)
                    .join(" ")}
                >
                  <span className={styles.ruleDot} aria-hidden>
                    {met ? "✓" : ""}
                  </span>
                  {r.label}
                </li>
              );
            })}
          </ul>

          <Button
            type="submit"
            variant="coral"
            size="lg"
            full
            loading={status === "submitting"}
            disabled={!canSubmit || hasSession === null || needsName === null}
            iconRight={<Icon name="arrow" size={15} />}
          >
            {needsName ? "Finish setup" : "Update password"}
          </Button>

          {status === "error" && error && (
            <p className={styles.error}>{error}</p>
          )}
        </form>

        <Link href="/" className={styles.back}>
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
