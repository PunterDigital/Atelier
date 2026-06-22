"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";

import { authClient } from "@/lib/auth-client";

import styles from "../auth.module.css";
import { AuthToggle, GoogleButton } from "../auth-shell";

// The hostname is a browser-only value that never changes within a session, so
// there is nothing to subscribe to.
const subscribeToHost = () => () => {};

// Terms/privacy consent is only required on the hosted app. Read the host
// through useSyncExternalStore so the server snapshot (and first client paint)
// is false - matching, so no hydration mismatch - and the client then resolves
// the real hostname. This keeps the host detection out of an effect.
function useRequireConsent() {
  return useSyncExternalStore(
    subscribeToHost,
    () => window.location.hostname === "app.useclerq.net",
    () => false,
  );
}

export function SignUpForm({
  googleEnabled,
  redirectTo,
}: {
  googleEnabled: boolean;
  redirectTo?: string;
}) {
  const router = useRouter();
  // Invited sign-ups return to the accept screen; everyone else goes to set
  // up their own business.
  const destination = redirectTo ?? "/onboarding";
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const requireConsent = useRequireConsent();
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (requireConsent && !acceptedTerms) {
      setError("Please accept the Terms of Service and Privacy Policy");
      return;
    }
    setError(null);
    setPending(true);
    const { error: signUpError } = await authClient.signUp.email({
      name,
      email,
      password,
    });
    if (signUpError) {
      setPending(false);
      setError(signUpError.message ?? "Could not create your account");
      return;
    }
    router.push(destination);
    router.refresh();
  }

  return (
    <>
      <AuthToggle active="signup" redirectTo={redirectTo} />
      <h1 className={styles.formTitle}>Create your account</h1>
      <p className={styles.formSub}>Start running your back office in seconds.</p>

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
          <label htmlFor="name">Your name</label>
          <input
            id="name"
            autoComplete="name"
            required
            placeholder="Sam Rivera"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
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
            autoComplete="new-password"
            required
            minLength={8}
            placeholder="••••••••"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </div>
        {requireConsent ? (
          <label className={styles.consent}>
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
            />
            <span>
              I agree to the{" "}
              <Link
                href="https://useclerq.net/terms"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.consentLink}
              >
                Terms of Service
              </Link>{" "}
              and{" "}
              <Link
                href="https://useclerq.net/privacy"
                target="_blank"
                rel="noopener noreferrer"
                className={styles.consentLink}
              >
                Privacy Policy
              </Link>
            </span>
          </label>
        ) : null}
        {error ? (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          className={styles.submit}
          disabled={pending || (requireConsent && !acceptedTerms)}
        >
          {pending ? (
            <>
              <span className={styles.spinner} />
              Creating your account
            </>
          ) : (
            "Create account"
          )}
        </button>
      </form>
    </>
  );
}
