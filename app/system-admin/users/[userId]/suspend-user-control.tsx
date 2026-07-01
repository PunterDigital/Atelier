"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTRPC } from "@/server/trpc/client";

export function SuspendUserControl({
  userId,
  suspended,
}: {
  userId: string;
  suspended: boolean;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const [expanded, setExpanded] = useState(false);
  const [reason, setReason] = useState("");

  const suspend = useMutation(
    trpc.admin.suspendUser.mutationOptions({
      onSuccess: () => {
        setExpanded(false);
        setReason("");
        router.refresh();
      },
    }),
  );
  const reactivate = useMutation(
    trpc.admin.reactivateUser.mutationOptions({ onSuccess: () => router.refresh() }),
  );

  if (suspended) {
    return (
      <div className="flex flex-col items-start gap-2">
        <Button
          variant="outline"
          disabled={reactivate.isPending}
          onClick={() => reactivate.mutate({ userId })}
        >
          Reactivate account
        </Button>
        {reactivate.error && (
          <p role="alert" className="text-sm text-destructive">
            {reactivate.error.message}
          </p>
        )}
      </div>
    );
  }

  if (!expanded) {
    return (
      <Button variant="destructive" onClick={() => setExpanded(true)}>
        Suspend account
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3">
      <label className="text-sm font-medium" htmlFor="suspend-reason">
        Reason (optional, shown on the suspension notice)
      </label>
      <Input
        id="suspend-reason"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Why is this account being suspended?"
      />
      <div className="flex gap-2">
        <Button
          variant="destructive"
          disabled={suspend.isPending}
          onClick={() => suspend.mutate({ userId, reason: reason.trim() || undefined })}
        >
          Confirm suspension
        </Button>
        <Button variant="ghost" onClick={() => setExpanded(false)}>
          Cancel
        </Button>
      </div>
      {suspend.error && (
        <p role="alert" className="text-sm text-destructive">
          {suspend.error.message}
        </p>
      )}
    </div>
  );
}
