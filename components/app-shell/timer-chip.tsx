"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Square } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { formatClock } from "@/lib/format";
import { useTRPC } from "@/server/trpc/client";

function useNowTick(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!enabled) {
      return;
    }
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [enabled]);
  return now;
}

// The running timer, always visible in the topbar (design kit: the active
// task's timer is never out of sight).
export function TimerChip() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const running = useQuery(
    trpc.time.running.queryOptions(undefined, {
      refetchInterval: 60 * 1000,
      refetchOnWindowFocus: true,
    }),
  );
  const stop = useMutation(
    trpc.time.stop.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.time.running.queryKey(),
        });
        router.refresh();
      },
    }),
  );

  const now = useNowTick(Boolean(running.data));

  if (!running.data) {
    return null;
  }
  const elapsed = Math.max(
    0,
    Math.floor((now - new Date(running.data.startedAt).getTime()) / 1000),
  );

  return (
    <div className="flex items-center gap-2 rounded-full border border-[var(--primary-border)] bg-[var(--primary-subtle)] py-1 pl-3 pr-1">
      <Link
        href={`/projects/${running.data.projectId}`}
        className="max-w-44 truncate text-sm font-medium text-[var(--primary-subtle-fg)]"
      >
        {running.data.taskTitle}
      </Link>
      <span className="font-mono text-sm font-semibold text-[var(--primary-subtle-fg)] tabular">
        {formatClock(elapsed)}
      </span>
      <Button
        size="icon"
        variant="ghost"
        aria-label="Stop timer"
        disabled={stop.isPending}
        onClick={() => stop.mutate()}
        className="size-7 rounded-full text-[var(--primary-subtle-fg)] hover:bg-[var(--primary-subtle)]"
      >
        <Square className="size-3.5 fill-current" aria-hidden />
      </Button>
    </div>
  );
}
