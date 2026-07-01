"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/server/trpc/client";

export function AdminToggleControl({
  userId,
  isPlatformAdmin,
  isSelf,
}: {
  userId: string;
  isPlatformAdmin: boolean;
  isSelf: boolean;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const grant = useMutation(
    trpc.admin.grantAdmin.mutationOptions({ onSuccess: () => router.refresh() }),
  );
  const revoke = useMutation(
    trpc.admin.revokeAdmin.mutationOptions({ onSuccess: () => router.refresh() }),
  );

  if (isSelf) {
    return (
      <p className="text-sm text-muted-foreground">
        You cannot change your own platform admin access.
      </p>
    );
  }

  const mutation = isPlatformAdmin ? revoke : grant;

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        variant={isPlatformAdmin ? "outline" : "default"}
        disabled={mutation.isPending}
        onClick={() => mutation.mutate({ userId })}
      >
        {isPlatformAdmin ? "Revoke platform admin" : "Grant platform admin"}
      </Button>
      {mutation.error && (
        <p role="alert" className="text-sm text-destructive">
          {mutation.error.message}
        </p>
      )}
    </div>
  );
}
