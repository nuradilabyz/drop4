"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Icon } from "@/components/ui/Icon";
import { Logo } from "@/components/ui/Logo";
import styles from "./login.module.css";

type Status = "idle" | "sending" | "sent" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const redirectTo =
    typeof window !== "undefined" ? `${window.location.origin}/auth/callback` : undefined;

  async function sendMagicLink(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("sending");
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) {
      setError(error.message);
      setStatus("error");
    } else {
      setStatus("sent");
    }
  }

  return (
    <main className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.head}>
          <Logo size={26} />
          <h1 className={styles.title}>Sign in to Drop4</h1>
          <p className={styles.sub}>
            Save your ELO, climb your city&apos;s board, and unlock the AI coach.
          </p>
        </div>

        {status === "sent" ? (
          <div className={styles.sent}>
            <strong>Check your email</strong>
            <span>
              We sent a magic link to <span className="mono">{email}</span>. Open it on this
              device to finish signing in.
            </span>
          </div>
        ) : (
          <>
            <form className={styles.form} onSubmit={sendMagicLink}>
              <Input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                lead={<Icon name="user" size={14} />}
              />
              <Button
                type="submit"
                variant="coral"
                size="lg"
                full
                loading={status === "sending"}
                iconRight={<Icon name="arrow" size={15} />}
              >
                Send magic link
              </Button>
            </form>

            {status === "error" && error && <p className={styles.error}>{error}</p>}
          </>
        )}

        <p className={styles.fine}>
          By continuing you agree to play fair. No spam — magic links only.
        </p>
        <Link href="/" className={styles.back}>
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
