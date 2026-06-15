"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { authClient } from "@/lib/auth-client";

import styles from "../auth.module.css";
import { AuthToggle, GoogleButton } from "../auth-shell";

export function SignInForm({
  googleEnabled,
  redirectTo,
}: {
  googleEnabled: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  const destination = redirectTo ?? "/";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setPending(true);
    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });
    if (signInError) {
      setPending(false);
      setError(signInError.message ?? "Could not sign you in");
      return;
    }
    router.push(destination);
    router.refresh();
  }

  return (
    <>
      <AuthToggle active="signin" redirectTo={redirectTo} />
      <h1 className={styles.formTitle}>Welcome back</h1>
      <p className={styles.formSub}>Sign in to pick up where you left off.</p>

      {googleEnabled ? (
        <GoogleButton
          disabled={pending}
          onClick={() =>
            authClient.signIn.social({
              provider: "google",
              callbackURL: destination,
            })
          }
        />
      ) : null}

      <form onSubmit={handleSubmit}>
        <div className={styles.field}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@studio.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className={`${styles.field} ${styles.fieldLast}`}>
          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <button type="submit" className={styles.submit} disabled={pending}>
          {pending ? (
            <>
              <span className={styles.spinner} />
              Signing in
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </>
  );
}
