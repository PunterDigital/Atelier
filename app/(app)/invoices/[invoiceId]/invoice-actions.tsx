"use client";

import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/server/trpc/client";

export function InvoiceActions({
  invoiceId,
  status,
  hasLines,
}: {
  invoiceId: string;
  status: "draft" | "sent" | "paid" | "overdue";
  hasLines: boolean;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const issue = useMutation(
    trpc.invoices.issue.mutationOptions({ onSuccess: () => router.refresh() }),
  );
  const markPaid = useMutation(
    trpc.invoices.markPaid.mutationOptions({
      onSuccess: () => router.refresh(),
    }),
  );

  if (status === "draft") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          disabled={!hasLines || issue.isPending}
          onClick={() => issue.mutate({ invoiceId })}
        >
          {issue.isPending ? "Issuing..." : "Issue invoice"}
        </Button>
        <p className="text-xs text-muted-foreground">
          {hasLines
            ? "Issuing assigns the number - it cannot be undone"
            : "Add lines before issuing"}
        </p>
        {issue.error ? (
          <p role="alert" className="text-xs text-destructive">
            {issue.error.message}
          </p>
        ) : null}
      </div>
    );
  }
  if (status === "sent" || status === "overdue") {
    return (
      <div className="flex flex-col items-end gap-1">
        <Button
          variant="outline"
          disabled={markPaid.isPending}
          onClick={() => markPaid.mutate({ invoiceId })}
        >
          {markPaid.isPending ? "Recording..." : "Mark as paid"}
        </Button>
        {markPaid.error ? (
          <p role="alert" className="text-xs text-destructive">
            {markPaid.error.message}
          </p>
        ) : null}
      </div>
    );
  }
  return null;
}

export function RemoveLineButton({ lineId }: { lineId: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const remove = useMutation(
    trpc.invoices.deleteLine.mutationOptions({
      onSuccess: () => router.refresh(),
    }),
  );
  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Remove line (its time entries return to unbilled)"
      disabled={remove.isPending}
      onClick={() => remove.mutate({ lineId })}
      className="size-7 shrink-0"
    >
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}
