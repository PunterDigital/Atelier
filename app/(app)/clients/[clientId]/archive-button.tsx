"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/server/trpc/client";

export function ArchiveButton({
  clientId,
  archived,
}: {
  clientId: string;
  archived: boolean;
}) {
  const router = useRouter();
  const trpc = useTRPC();

  const archive = useMutation(
    trpc.clients.archive.mutationOptions({
      onSuccess: () => router.refresh(),
    }),
  );
  const unarchive = useMutation(
    trpc.clients.unarchive.mutationOptions({
      onSuccess: () => router.refresh(),
    }),
  );
  const mutation = archived ? unarchive : archive;

  return (
    <Button
      variant="ghost"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate({ clientId })}
    >
      {archived ? "Restore" : "Archive"}
    </Button>
  );
}
