"use client";

/**
 * Sign in / Create account. Three modes the user can flip between with the
 * tabs at the top:
 *
 *   - signin: email + password → `signInWithPassword`. Fast path for
 *     anyone who has an account already. No email round-trip.
 *   - signup: EMAIL ONLY → `signInWithOtp({ shouldCreateUser: true })`.
 *     Sends a one-click confirmation link. When the user clicks it,
 *     `/auth/callback` exchanges the code for a session and forwards
 *     them to `/account/password`, where they set their first password.
 *     The order — confirm-then-choose-password — is what the user asked
 *     for, and avoids the awkward "invent a password before you've even
 *     proved the email is yours" pattern.
 *   - reset: email-only → `resetPasswordForEmail`. Sends a link that
 *     also lands on `/account/password` with a recovery session.
 */

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import styles from "./login.module.css";

type Mode = "signin" | "signup" | "reset";
type Status = "idle" | "submitting" | "sent" | "error";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

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
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmedEmail,
        options: {
          shouldCreateUser: true,
          // Send the confirm click through the callback and on to the
          // password-setup form — first-time visitors need a password
          // before sign-in becomes useful.
          emailRedirectTo: `${window.location.origin}/auth/callback?next=/account/password`,
        },
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
              <span className="mono">{email}</span>.
              {mode === "signup"
                ? " Tap it to confirm your email — then you'll choose a password."
                : " Tap it to choose a new password."}
            </p>
          </div>
          <p className={styles.notice}>
            Didn&apos;t get it? Check spam, and give it a minute — Supabase&apos;s
            built-in mailer can be slow. If you still don&apos;t see it after
            a few minutes, the project is on the test mailer&apos;s 2-emails-
            per-hour cap; wait and retry.
          </p>
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

        {isSignup && (
          <p className={styles.notice}>
            We&apos;ll email you a confirmation link. After you tap it,
            you&apos;ll choose a password — that&apos;s what you&apos;ll use
            to sign in next time.
          </p>
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

          {mode === "signin" && (
            <Input
              type="password"
              required
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              lead={<Icon name="lock" size={14} />}
            />
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
                ? "Send confirmation link"
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
