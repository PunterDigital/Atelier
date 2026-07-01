"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useTRPC } from "@/server/trpc/client";

export function SystemAdminForm({
  initial,
}: {
  initial: { currentVersion: string | null; updateChecksEnabled: boolean };
}) {
  const router = useRouter();
  const trpc = useTRPC();
  // Local so the checkbox reflects the click immediately rather than
  // snapping back to the server value while the mutation is in flight.
  const [enabled, setEnabled] = useState(initial.updateChecksEnabled);

  const update = useMutation(
    trpc.system.setUpdateChecksEnabled.mutationOptions({
      onSuccess: () => router.refresh(),
      onError: () => setEnabled(initial.updateChecksEnabled),
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>System Administration</CardTitle>
        <CardDescription>
          Instance-wide preferences for this self-hosted deployment
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="text-sm text-muted-foreground">
          Running version{" "}
          <span className="font-mono text-foreground">
            {initial.currentVersion ?? "unknown"}
          </span>
        </p>
        <div className="flex items-start gap-2">
          <input
            id="updateChecks"
            type="checkbox"
            checked={enabled}
            disabled={update.isPending}
            onChange={(e) => {
              setEnabled(e.target.checked);
              update.mutate({ enabled: e.target.checked });
            }}
            className="mt-1 h-4 w-4 rounded border shadow-xs accent-primary"
          />
          <div className="flex flex-col gap-1">
            <Label htmlFor="updateChecks">Check for updates</Label>
            <p className="text-sm text-muted-foreground">
              Periodically checks GHCR for a newer Clerq release and shows a
              banner when one is available. Never sends any data about this
              instance - it only reads the public release list.
            </p>
          </div>
        </div>
        {update.error ? (
          <p role="alert" className="text-sm text-destructive">
            {update.error.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
