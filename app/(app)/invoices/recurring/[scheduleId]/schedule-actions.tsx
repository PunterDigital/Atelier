"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useTRPC } from "@/server/trpc/client";

type Status = "active" | "paused" | "ended";

export function ScheduleActions({
  scheduleId,
  status,
}: {
  scheduleId: string;
  status: Status;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const [notice, setNotice] = useState<string | null>(null);

  const refresh = () => router.refresh();

  const setStatus = useMutation(
    trpc.recurring.setStatus.mutationOptions({
      onSuccess: () => {
        setNotice(null);
        refresh();
      },
    }),
  );
  const generate = useMutation(
    trpc.recurring.generateNow.mutationOptions({
      onSuccess: (result) => {
        setNotice(
          result.error ??
            (result.generated > 0
              ? result.issued
                ? "Invoice generated and issued."
                : "Draft invoice generated."
              : "Nothing to generate."),
        );
        refresh();
      },
    }),
  );

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex flex-wrap items-center justify-end gap-2">
        {status === "active" ? (
          <Button
            variant="outline"
            disabled={generate.isPending}
            onClick={() => generate.mutate({ scheduleId })}
          >
            {generate.isPending ? "Generating..." : "Generate next now"}
          </Button>
        ) : null}
        {status === "active" ? (
          <Button
            variant="outline"
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate({ scheduleId, status: "paused" })}
          >
            Pause
          </Button>
        ) : null}
        {status === "paused" ? (
          <Button
            variant="outline"
            disabled={setStatus.isPending}
            onClick={() => setStatus.mutate({ scheduleId, status: "active" })}
          >
            Resume
          </Button>
        ) : null}
        {status !== "ended" ? (
          <Button variant="outline" asChild>
            <Link href={`/invoices/recurring/${scheduleId}/edit`}>Edit</Link>
          </Button>
        ) : null}
        {status !== "ended" ? <EndControl scheduleId={scheduleId} /> : null}
        <DeleteControl scheduleId={scheduleId} />
      </div>
      {notice ? (
        <p role="status" className="text-xs text-muted-foreground">
          {notice}
        </p>
      ) : null}
      {generate.error ? (
        <p role="alert" className="text-xs text-destructive">
          {generate.error.message}
        </p>
      ) : null}
      {setStatus.error ? (
        <p role="alert" className="text-xs text-destructive">
          {setStatus.error.message}
        </p>
      ) : null}
    </div>
  );
}

// Ending is terminal (to restart, make a fresh schedule), so it confirms first.
function EndControl({ scheduleId }: { scheduleId: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const end = useMutation(
    trpc.recurring.setStatus.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        router.refresh();
      },
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (end.isPending) return;
        setOpen(next);
        if (!next) end.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost">End</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>End this recurring invoice?</DialogTitle>
          <DialogDescription>
            It stops generating new invoices. Ones it already created are kept.
            This can&apos;t be undone - to bill this client again, create a new
            recurring invoice.
          </DialogDescription>
        </DialogHeader>
        {end.error ? (
          <p role="alert" className="text-sm text-destructive">
            {end.error.message}
          </p>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" disabled={end.isPending} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={end.isPending}
            onClick={() => end.mutate({ scheduleId, status: "ended" })}
          >
            {end.isPending ? "Ending..." : "End it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Deletes the schedule outright. Its generated invoices survive (they detach),
// so this is about removing the template, not the documents.
function DeleteControl({ scheduleId }: { scheduleId: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const remove = useMutation(
    trpc.recurring.delete.mutationOptions({
      onSuccess: () => {
        setOpen(false);
        router.push("/invoices/recurring");
        router.refresh();
      },
    }),
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (remove.isPending) return;
        setOpen(next);
        if (!next) remove.reset();
      }}
    >
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-destructive hover:text-destructive">
          Delete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete this recurring invoice?</DialogTitle>
          <DialogDescription>
            This removes the schedule and its template. Invoices it already
            generated are kept. This cannot be undone.
          </DialogDescription>
        </DialogHeader>
        {remove.error ? (
          <p role="alert" className="text-sm text-destructive">
            {remove.error.message}
          </p>
        ) : null}
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={remove.isPending}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate({ scheduleId })}
          >
            {remove.isPending ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
