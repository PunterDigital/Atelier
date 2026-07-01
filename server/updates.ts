import { eq } from "drizzle-orm";

import { getDb, schema } from "@/db";
import { compareVersions, RELEASE_TAG } from "@/lib/semver";
import { currentVersion } from "@/lib/version";

// Self-hosted update checking: is a newer Clerq release published to GHCR
// than the one this instance is running? Cloud (app.useclerq.com) is managed
// centrally and never checks or prompts - see isCloudInstance below.

const CLOUD_HOSTNAME = "app.useclerq.com";

// BETTER_AUTH_URL is "the URL your instance is reached on" (see .env.example)
// - a deployment-level setting, not a per-request header, so this can't be
// spoofed by a client and needs no request context to call.
export function isCloudInstance(): boolean {
  try {
    return new URL(process.env.BETTER_AUTH_URL ?? "").hostname === CLOUD_HOSTNAME;
  } catch {
    return false;
  }
}

// The image published by .github/workflows/release.yml.
const GHCR_IMAGE = "punterdigital/clerq";

export type GhcrDeps = {
  // Injected in tests; defaults to the global fetch in production.
  fetch?: typeof fetch;
};

// GHCR serves anonymous pulls for public packages via the standard OCI
// registry v2 API: a short-lived pull token, then the tag list. No GitHub
// token needed - the release workflow's one-time setup makes the package
// public.
async function fetchGhcrTags(
  doFetch: typeof fetch,
  signal: AbortSignal,
): Promise<string[]> {
  const tokenRes = await doFetch(
    `https://ghcr.io/token?scope=repository:${GHCR_IMAGE}:pull`,
    { signal },
  );
  if (!tokenRes.ok) {
    throw new Error(`GHCR token request failed (${tokenRes.status})`);
  }
  const { token } = (await tokenRes.json()) as { token: string };

  const tagsRes = await doFetch(`https://ghcr.io/v2/${GHCR_IMAGE}/tags/list`, {
    headers: { Authorization: `Bearer ${token}` },
    signal,
  });
  if (!tagsRes.ok) {
    throw new Error(`GHCR tags request failed (${tagsRes.status})`);
  }
  const { tags } = (await tagsRes.json()) as { tags: string[] };
  return tags;
}

// The latest published release tag ("1.3.1" style; "latest", "1.3" and
// "sha-<hash>" tags are ignored). Never throws - a self-hosted instance may
// have no internet access, and a failed check should never break the app -
// callers see a null they can treat as "couldn't tell".
export async function fetchLatestGhcrVersion(
  deps: GhcrDeps = {},
): Promise<string | null> {
  const doFetch = deps.fetch ?? fetch;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5_000);
  try {
    const tags = await fetchGhcrTags(doFetch, controller.signal);
    const releases = tags.filter((tag) => RELEASE_TAG.test(tag));
    if (releases.length === 0) return null;
    return releases.reduce((latest, tag) =>
      compareVersions(tag, latest) > 0 ? tag : latest,
    );
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

// In-process cache so the GHCR check runs at most once per window, however
// many requests hit the server meanwhile. Resets on restart - self-hosted
// instances run as a single long-lived container, so the first request after
// a restart just re-primes it.
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
let cache: { version: string | null; checkedAt: number } | null = null;

// Test-only seam, mirroring db's setTestDb: each test starts from a clean
// cache rather than leaking state from whichever test ran first.
export function resetUpdateCheckCache(): void {
  cache = null;
}

async function cachedLatestGhcrVersion(deps: GhcrDeps): Promise<string | null> {
  if (cache && Date.now() - cache.checkedAt < CHECK_INTERVAL_MS) {
    return cache.version;
  }
  const version = await fetchLatestGhcrVersion(deps);
  cache = { version, checkedAt: Date.now() };
  return version;
}

// Reads default to enabled: a fresh instance that has never touched the
// setting has no row yet (see db/schema.ts), and the column default is true.
export async function getUpdateChecksEnabled(): Promise<boolean> {
  const [row] = await getDb()
    .select({ updateChecksEnabled: schema.instanceSettings.updateChecksEnabled })
    .from(schema.instanceSettings)
    .where(eq(schema.instanceSettings.id, "singleton"));
  return row?.updateChecksEnabled ?? true;
}

export async function setUpdateChecksEnabled(enabled: boolean): Promise<void> {
  await getDb()
    .insert(schema.instanceSettings)
    .values({ id: "singleton", updateChecksEnabled: enabled })
    .onConflictDoUpdate({
      target: schema.instanceSettings.id,
      set: { updateChecksEnabled: enabled, updatedAt: new Date() },
    });
}

export type UpdateStatus =
  | { checked: false }
  | {
      checked: true;
      currentVersion: string;
      latestVersion: string;
      updateAvailable: boolean;
    };

// The full decision, in order: skip entirely for the cloud instance, when
// this build carries no baked-in version (local/dev builds have nothing to
// compare), or when the deployment has turned checking off; otherwise compare
// the running version against the latest GHCR release.
export async function getUpdateStatus(deps: GhcrDeps = {}): Promise<UpdateStatus> {
  const running = currentVersion();
  if (isCloudInstance() || !running) return { checked: false };
  if (!(await getUpdateChecksEnabled())) return { checked: false };

  const latestVersion = await cachedLatestGhcrVersion(deps);
  if (!latestVersion) return { checked: false };

  return {
    checked: true,
    currentVersion: running,
    latestVersion,
    updateAvailable: compareVersions(latestVersion, running) > 0,
  };
}
