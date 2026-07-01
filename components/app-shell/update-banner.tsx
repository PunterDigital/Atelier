"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

// Dismissal is session-only (component state, not persisted): reappearing
// after a refresh is the point - it nudges again on the next visit rather
// than being silenced for good after one click.
export function UpdateBanner({
  currentVersion,
  latestVersion,
}: {
  currentVersion: string;
  latestVersion: string;
}) {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed) return null;

  return (
    <div className="flex shrink-0 items-center justify-between gap-4 border-b bg-accent/50 px-4 py-2 text-sm sm:px-6">
      <span>
        A new version of Clerq is available: v{currentVersion} &rarr; v
        {latestVersion}.{" "}
        <a
          href={`https://github.com/PunterDigital/clerq/releases/tag/v${latestVersion}`}
          target="_blank"
          rel="noreferrer"
          className="underline underline-offset-2"
        >
          View release
        </a>{" "}
        - manage this in Settings under System Administration.
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => setDismissed(true)}
      >
        Dismiss
      </Button>
    </div>
  );
}
