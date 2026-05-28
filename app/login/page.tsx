"use client";

/**
 * Sign in / Create account. Three modes the user can flip between with the
 * tabs at the top:
 *
 *   - signin: email + password → `signInWithPassword`. Fast path for
 *     anyone who has an account already.
 *   - signup: email + password + live policy checklist → `signUp`.
 *     Confirmation email is sent; user clicks the link to verify.
 *   - reset: email-only → `resetPasswordForEmail`. Sends a link that
 *     drops the user on `/account/password` with a recovery session.
 *
 * The "magic link" entry point was removed because the user wanted
 * password-based login as the primary mechanism so returning users
 * don't have to fetch a new email every time. Forgot-password is the
 * remaining email round-trip and that's only on the recovery path.
 */

import { useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import styles from "./login.module.css";

type Mode = "signin" | "signup" | "reset";
type Status = "idle" | "submitting" | "sent" | "error";

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

function evalRules(pw: string): boolean[] {
  return RULES.map((r) => r.test(pw));
}

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const ruleStates = useMemo(() => evalRules(password), [password]);
  const allRulesMet = ruleStates.every(Boolean);

  const redirectTo =
    typeof window !== "undefined"
      ? `${window.location.origin}/auth/callback`
      : undefined;

  function reset() {
    setStatus("idle");
    setError(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;

    setStatus("submitting");
    setError(null);
    const supabase = createClient();

    if (mode === "signin") {
      const { error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });
      if (error) {
        setError(error.message);
        setStatus("error");
      } else {
        // Hard redirect so the server-rendered Nav re-evaluates the cookie.
        window.location.href = "/";
      }
      return;
    }

    if (mode === "signup") {
      if (!allRulesMet) {
        setError("Your password doesn't meet the requirements below.");
        setStatus("error");
        return;
      }
      const { error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        setError(error.message);
        setStatus("error");
      } else {
        setStatus("sent");
      }
      return;
    }

    // mode === "reset"
    const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
      // Route through the regular callback so the recovery code is exchanged
      // for a session, then land on the form that actually changes the
      // password.
      redirectTo: `${window.location.origin}/auth/callback?next=/account/password`,
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  // Successful signup / reset → user needs to check their inbox.
  if (status === "sent") {
    return (
      <main className={styles.wrap}>
        <div className={styles.card}>
          <div className={styles.head}>
            <Logo size={26} />
            <h1 className={styles.title}>Check your email</h1>
            <p className={styles.sub}>
              {mode === "signup"
                ? "We sent a confirmation link to "
                : "We sent a password-reset link to "}
              <span className="mono">{email}</span>. Open it on this device to
              continue.
            </p>
          </div>
          <button
            type="button"
            className={styles.auxLink}
            onClick={() => {
              setStatus("idle");
              setMode("signin");
            }}
          >
            ← Back to sign in
          </button>
          <Link href="/" className={styles.back}>
            ← Back to home
          </Link>
        </div>
      </main>
    );
  }

  const isSignup = mode === "signup";
  const isReset = mode === "reset";

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.head}>
          <Logo size={26} />
          <h1 className={styles.title}>
            {isReset ? "Reset your password" : "Sign in to Drop4"}
          </h1>
          <p className={styles.sub}>
            {isReset
              ? "Enter your email and we'll send a link to choose a new password."
              : "Save your ELO, climb your city's board, and unlock the AI coach."}
          </p>
        </div>

        {!isReset && (
          <div className={styles.tabs} role="tablist" aria-label="Auth mode">
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signin"}
              className={[styles.tab, mode === "signin" && styles.tabActive]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                setMode("signin");
                reset();
              }}
            >
              Sign in
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "signup"}
              className={[styles.tab, mode === "signup" && styles.tabActive]
                .filter(Boolean)
                .join(" ")}
              onClick={() => {
                setMode("signup");
                reset();
              }}
            >
              Create account
            </button>
          </div>
        )}

        <form className={styles.form} onSubmit={onSubmit}>
          <Input
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            lead={<Icon name="user" size={14} />}
          />

          {!isReset && (
            <Input
              type="password"
              required
              autoComplete={isSignup ? "new-password" : "current-password"}
              placeholder={isSignup ? "Create a password" : "Your password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              lead={<Icon name="lock" size={14} />}
            />
          )}

          {isSignup && (
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
            iconRight={<Icon name="arrow" size={15} />}
          >
            {isReset
              ? "Send reset link"
              : isSignup
                ? "Create account"
                : "Sign in"}
          </Button>

          {status === "error" && error && <p className={styles.error}>{error}</p>}
        </form>

        {!isReset ? (
          <div className={styles.aux}>
            <button
              type="button"
              className={styles.auxLink}
              onClick={() => {
                setMode("reset");
                reset();
              }}
            >
              Forgot password?
            </button>
            <span className={styles.auxLink} aria-hidden>
              ·
            </span>
            <button
              type="button"
              className={styles.auxLink}
              onClick={() => {
                setMode(isSignup ? "signin" : "signup");
                reset();
              }}
            >
              {isSignup ? "I already have an account" : "Create a new account"}
            </button>
          </div>
        ) : (
          <div className={styles.aux}>
            <button
              type="button"
              className={styles.auxLink}
              onClick={() => {
                setMode("signin");
                reset();
              }}
            >
              ← Back to sign in
            </button>
          </div>
        )}

        <p className={styles.fine}>
          By continuing you agree to play fair. We never share your email.
        </p>
        <Link href="/" className={styles.back}>
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
