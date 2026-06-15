"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/server/trpc/client";

export function AcceptForm({
  token,
  businessName,
}: {
  token: string;
  businessName: string;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const accept = useMutation(
    trpc.team.accept.mutationOptions({
      onSuccess: () => {
        // Land in the app; if this is their first/active business they go
        // straight to the dashboard.
        router.push("/");
        router.refresh();
      },
    }),
  );

  return (
    <div className="flex flex-col gap-3">
      <Button
        disabled={accept.isPending}
        onClick={() => accept.mutate({ token })}
      >
        {accept.isPending ? "Joining..." : `Join ${businessName}`}
      </Button>
      {accept.error ? (
        <p role="alert" className="text-sm text-destructive">
          {accept.error.message}
        </p>
      ) : null}
    </div>
  );
}
