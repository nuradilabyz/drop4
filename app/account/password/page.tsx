"use client";

/**
 * Set new password. Lands here after the recovery email link goes through
 * /auth/callback — at that point Supabase has handed us a session that's
 * authorized to update the password, but nothing else useful for the
 * user yet. We just need a single form to call `updateUser({ password })`.
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

export default function SetPasswordPage() {
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [hasSession, setHasSession] = useState<boolean | null>(null);

  // Guard the form: if the user navigated here without a valid recovery
  // session (typed the URL manually, or the link expired) there's nothing
  // for them to update — surface the dead end instead of a silent failure.
  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    supabase.auth.getUser().then(({ data, error }) => {
      if (!mounted) return;
      setHasSession(!!data.user && !error);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const ruleStates = useMemo(() => RULES.map((r) => r.test(password)), [password]);
  const allRulesMet = ruleStates.every(Boolean);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allRulesMet) {
      setError("Your password doesn't meet the requirements below.");
      setStatus("error");
      return;
    }
    setStatus("submitting");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
      setStatus("error");
      return;
    }
    setStatus("success");
    // Hard redirect so server-rendered nav picks up the fresh session.
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
              This password-reset link is no longer valid. Request a fresh one
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
            <h1 className={styles.title}>Password updated</h1>
            <p className={styles.sub}>Signing you in…</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.head}>
          <Logo size={26} />
          <h1 className={styles.title}>Choose a new password</h1>
          <p className={styles.sub}>
            Pick something strong. You&apos;ll sign in with this from now on.
          </p>
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          <Input
            type="password"
            required
            autoComplete="new-password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            lead={<Icon name="lock" size={14} />}
            autoFocus
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
            disabled={!allRulesMet || hasSession === null}
            iconRight={<Icon name="arrow" size={15} />}
          >
            Update password
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
