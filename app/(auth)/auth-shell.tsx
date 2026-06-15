import Link from "next/link";

import styles from "./auth.module.css";

function ClerqMark({ size = 21 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <path
        d="M22.5 11.4a7.2 7.2 0 1 0 .3 9.1"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <circle cx="22.2" cy="16" r="2.1" fill="currentColor" />
    </svg>
  );
}

function Check() {
  return (
    <svg
      width="19"
      height="19"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={styles.bcIc}
      aria-hidden="true"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// The dark brand panel shared by sign-in and sign-up, plus the surrounding
// two-panel grid. The right-hand form panel is supplied as children.
export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className={styles.auth}>
      <div className={styles.brandPanel}>
        <div className={styles.brandGlow} />
        <div className={styles.brandTop}>
          <span className={styles.brandMark}>
            <ClerqMark />
          </span>
          <span className={styles.brandName}>Clerq</span>
        </div>
        <div className={styles.brandMid}>
          <h2 className={styles.brandH}>Less back office. More of the work you love.</h2>
          <div className={styles.brandChecks}>
            <div className={styles.bc}>
              <Check />
              <span>Track time, invoice, and get paid in one flow</span>
            </div>
            <div className={styles.bc}>
              <Check />
              <span>Your data on your terms &mdash; export anything, any time</span>
            </div>
            <div className={styles.bc}>
              <Check />
              <span>Open source and self-hostable &mdash; no lock-in</span>
            </div>
          </div>
        </div>
        <div className={styles.brandFoot}>
          Prefer to run it yourself?{" "}
          <Link href="/docs/self-hosting/docker-compose" className={styles.brandLink}>
            Self-host with Docker &rarr;
          </Link>
        </div>
      </div>

      <div className={styles.formPanel}>
        <div className={styles.formBox}>{children}</div>
      </div>
    </div>
  );
}

// Pill toggle between the two auth routes; preserves an invite ?redirect= when
// present so switching tabs mid-invite doesn't drop the destination.
export function AuthToggle({
  active,
  redirectTo,
}: {
  active: "signup" | "signin";
  redirectTo?: string;
}) {
  const query = redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : "";
  return (
    <div className={styles.seg}>
      <Link
        href={`/sign-up${query}`}
        className={`${styles.segBtn} ${active === "signup" ? styles.on : ""}`}
      >
        Sign up
      </Link>
      <Link
        href={`/sign-in${query}`}
        className={`${styles.segBtn} ${active === "signin" ? styles.on : ""}`}
      >
        Sign in
      </Link>
    </div>
  );
}

export function GoogleButton({
  onClick,
  disabled,
}: {
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <>
      <button
        type="button"
        className={styles.google}
        onClick={onClick}
        disabled={disabled}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M21.8 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.5a4.7 4.7 0 0 1-2 3.1v2.6h3.2c1.9-1.7 3-4.3 3-7.5Z"
            fill="#4285F4"
          />
          <path
            d="M12 22c2.7 0 5-.9 6.7-2.4l-3.2-2.6c-.9.6-2 1-3.5 1-2.7 0-5-1.8-5.8-4.3H3v2.7A10 10 0 0 0 12 22Z"
            fill="#34A853"
          />
          <path d="M6.2 13.7a6 6 0 0 1 0-3.8V7.2H3a10 10 0 0 0 0 9l3.2-2.5Z" fill="#FBBC05" />
          <path
            d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3 7.2l3.2 2.7C7 7.6 9.3 5.9 12 5.9Z"
            fill="#EA4335"
          />
        </svg>
        Continue with Google
      </button>
      <div className={styles.or}>
        <span className={styles.orLine} />
        <span className={styles.orText}>or</span>
        <span className={styles.orLine} />
      </div>
    </>
  );
}
