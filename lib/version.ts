// The running build's version, baked into the Docker image at release build
// time (see the Dockerfile's CLERQ_VERSION build arg and
// .github/workflows/release.yml, which passes the pushed tag). Bare
// "1.3.1" style, matching the tags the release workflow pushes to GHCR - no
// "v" prefix.
//
// Empty for anything not built by that workflow (local dev, `docker compose
// -f docker-compose.build.yml up --build`): callers must treat that as
// "unknown" and skip update checks rather than compare against it. A
// function (not a precomputed constant) so tests can vary it via env, like
// modules/expenses/ocr.ts's receiptScanConfig().
export function currentVersion(): string | null {
  return process.env.CLERQ_VERSION?.trim() || null;
}
