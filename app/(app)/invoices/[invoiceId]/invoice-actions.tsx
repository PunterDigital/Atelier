"use client";

import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
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
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/server/trpc/client";

export function InvoiceActions({
  invoiceId,
  status,
  hasLines,
}: {
  invoiceId: string;
  status: "draft" | "sent" | "paid" | "overdue" | "void";
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

  return (
    <div className="flex flex-col items-end gap-2">
      <div className="flex items-center gap-2">
        {status === "sent" || status === "overdue" ? (
          <Button
            variant="outline"
            disabled={markPaid.isPending}
            onClick={() => markPaid.mutate({ invoiceId })}
          >
            {markPaid.isPending ? "Recording..." : "Mark as paid"}
          </Button>
        ) : null}
        <DuplicateButton invoiceId={invoiceId} />
      </div>
      {markPaid.error ? (
        <p role="alert" className="text-xs text-destructive">
          {markPaid.error.message}
        </p>
      ) : null}
      {status === "sent" || status === "overdue" ? (
        <VoidControl invoiceId={invoiceId} />
      ) : null}
    </div>
  );
}

// Copies the invoice into a fresh draft and opens it. Available on any issued
// invoice (sent/overdue/paid/void) - re-issue a corrected copy, or reuse a
// past invoice as a starting point.
function DuplicateButton({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const duplicate = useMutation(
    trpc.invoices.duplicate.mutationOptions({
      onSuccess: (created) => {
        router.push(`/invoices/${created.id}`);
        router.refresh();
      },
    }),
  );
  return (
    <Button
      variant="outline"
      disabled={duplicate.isPending}
      onClick={() => duplicate.mutate({ invoiceId })}
    >
      {duplicate.isPending ? "Duplicating..." : "Duplicate"}
    </Button>
  );
}

// Voiding keeps the number but closes the invoice out. A short reason can be
// recorded; it shows on the invoice and in the client's activity thread. Two
// steps (reveal, then confirm) so a numbered document is never voided by a
// single stray click.
function VoidControl({ invoiceId }: { invoiceId: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const voidInvoice = useMutation(
    trpc.invoices.void.mutationOptions({
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
        // Don't let an outside-click/escape dismiss mid-request.
        if (voidInvoice.isPending) return;
        setOpen(next);
        if (!next) {
          setReason("");
          voidInvoice.reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="text-destructive hover:text-destructive"
        >
          Void invoice
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Void this invoice?</DialogTitle>
          <DialogDescription>
            It keeps its number but no longer counts as revenue. Duplicate it to
            re-issue a corrected copy.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="void-reason">Reason (optional)</Label>
          <textarea
            id="void-reason"
            rows={3}
            placeholder="e.g. client address changed"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
          {voidInvoice.error ? (
            <p role="alert" className="text-sm text-destructive">
              {voidInvoice.error.message}
            </p>
          ) : null}
        </div>
        <DialogFooter>
          <Button
            variant="ghost"
            disabled={voidInvoice.isPending}
            onClick={() => {
              setOpen(false);
              setReason("");
              voidInvoice.reset();
            }}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            disabled={voidInvoice.isPending}
            onClick={() =>
              voidInvoice.mutate({
                invoiceId,
                reason: reason.trim() || undefined,
              })
            }
          >
            {voidInvoice.isPending ? "Voiding..." : "Confirm void"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
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
