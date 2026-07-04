// A minimal comparator for the plain "X.Y.Z" tags this project's release
// workflow publishes (no "v" prefix, no pre-release suffix) - not a general
// semver library. Returns positive when `a` is newer than `b`, negative when
// `b` is newer, zero when equal.
export function compareVersions(a: string, b: string): number {
  const partsA = a.split(".").map(Number);
  const partsB = b.split(".").map(Number);
  const length = Math.max(partsA.length, partsB.length);
  for (let i = 0; i < length; i++) {
    const diff = (partsA[i] ?? 0) - (partsB[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

// Only tags shaped exactly like this project's releases ("1.3.1") are safe to
// feed to compareVersions - callers filter GHCR's tag list (which also
// contains "latest", "1.3", "sha-<hash>") with this before comparing.
export const RELEASE_TAG = /^\d+\.\d+\.\d+$/;
