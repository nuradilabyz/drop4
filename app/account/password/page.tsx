"use client";

/**
 * Account settings: change display name, change password, or both.
 * Reached from three entry points:
 *   - first-time signup confirm (no display_name yet — both fields required)
 *   - password recovery email (changing the password)
 *   - "Edit account" button on own profile (returning user editing either)
 *
 * All three share the same form. Name is pre-filled with the current
 * value; password is empty (placeholder makes clear it's optional unless
 * you're setting one for the first time). Submit only writes the fields
 * that actually changed — typing nothing into "password" keeps the old
 * one, deleting the name + typing a new one updates just the name, etc.
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

export default function AccountSettingsPage() {
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  /** The display_name we found in the DB on load. Used to detect "changed". */
  const [currentName, setCurrentName] = useState("");
  /** True only on first visit (no display_name yet) — forces both fields. */
  const [isFirstTime, setIsFirstTime] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);
  const [userId, setUserId] = useState<string | null>(null);

  // On mount: confirm the session is valid + pre-fill the name field with
  // whatever the user already chose (if anything). The user navigates here
  // from three places — recovery email, profile button, signup callback —
  // and we want all three to see one coherent form.
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
        .maybeSingle<{ display_name: string | null }>();
      if (!mounted) return;
      const existing = profile?.display_name ?? "";
      setCurrentName(existing);
      setDisplayName(existing);
      setIsFirstTime(!existing);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const ruleStates = useMemo(() => RULES.map((r) => r.test(password)), [password]);
  const allRulesMet = ruleStates.every(Boolean);

  const trimmedName = displayName.trim();
  const nameValid = trimmedName.length >= NAME_MIN && trimmedName.length <= NAME_MAX;
  const nameChanged = trimmedName !== currentName.trim();
  const passwordProvided = password.length > 0;

  // Submit rules:
  // - First-time: must set BOTH name and password.
  // - Returning: must change at LEAST ONE field; what's typed must be valid.
  let canSubmit: boolean;
  if (isFirstTime) {
    canSubmit = nameValid && passwordProvided && allRulesMet;
  } else {
    const nameOk = !nameChanged || nameValid;
    const pwOk = !passwordProvided || allRulesMet;
    canSubmit = (nameChanged || passwordProvided) && nameOk && pwOk;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStatus("submitting");
    setError(null);
    const supabase = createClient();

    const update: {
      password?: string;
      data?: { display_name: string };
    } = {};
    if (passwordProvided) update.password = password;
    if (nameChanged) update.data = { display_name: trimmedName };

    if (update.password || update.data) {
      const { error: updateErr } = await supabase.auth.updateUser(update);
      if (updateErr) {
        setError(updateErr.message);
        setStatus("error");
        return;
      }
    }

    if (nameChanged && userId) {
      // Mirror to the public profiles row so server-rendered surfaces
      // (Nav, leaderboard, duel header) see the new name immediately.
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ display_name: trimmedName })
        .eq("id", userId);
      if (profileErr) {
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
            <h1 className={styles.title}>Sign in to continue</h1>
            <p className={styles.sub}>
              You need to be signed in to edit your account. If you got here
              from an expired link, sign in (or request a fresh reset) below.
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
            <h1 className={styles.title}>Saved</h1>
            <p className={styles.sub}>Updating your session…</p>
          </div>
        </div>
      </main>
    );
  }

  const heading = isFirstTime
    ? "Finish setting up your account"
    : "Edit your account";
  const sub = isFirstTime
    ? "Pick a display name your opponents will see, and a password you'll use to sign in next time."
    : "Change your display name, your password, or both. Leave a field as-is to keep it.";

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.head}>
          <Logo size={26} />
          <h1 className={styles.title}>{heading}</h1>
          <p className={styles.sub}>{sub}</p>
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          <Input
            type="text"
            required={isFirstTime}
            autoComplete="nickname"
            placeholder="Display name (e.g. Aigerim)"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={NAME_MAX}
            lead={<Icon name="user" size={14} />}
            autoFocus={isFirstTime}
          />

          <Input
            type="password"
            required={isFirstTime}
            autoComplete="new-password"
            placeholder={
              isFirstTime
                ? "New password"
                : "New password (leave blank to keep current)"
            }
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            lead={<Icon name="lock" size={14} />}
            autoFocus={!isFirstTime}
          />

          {/* Rule checklist is only useful while a password is being typed —
           *  hide it otherwise so the form doesn't look like password is
           *  required when it isn't. */}
          {passwordProvided && (
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
          )}

          <Button
            type="submit"
            variant="coral"
            size="lg"
            full
            loading={status === "submitting"}
            disabled={!canSubmit || hasSession === null}
            iconRight={<Icon name="arrow" size={15} />}
          >
            {isFirstTime ? "Finish setup" : "Save changes"}
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
