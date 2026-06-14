"use client";

import { useMutation } from "@tanstack/react-query";
import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/server/trpc/client";

// The headline action: flip paid <-> unpaid. The label reflects the action,
// not the current state, so it always reads as the thing it will do.
export function TogglePaidButton({
  expenseId,
  status,
}: {
  expenseId: string;
  status: "unpaid" | "paid";
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const setStatus = useMutation(
    trpc.expenses.setStatus.mutationOptions({
      onSuccess: () => router.refresh(),
    }),
  );
  const next = status === "paid" ? "unpaid" : "paid";

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant={next === "paid" ? "default" : "outline"}
        disabled={setStatus.isPending}
        onClick={() => setStatus.mutate({ expenseId, status: next })}
      >
        {setStatus.isPending
          ? "Saving..."
          : next === "paid"
            ? "Mark as paid"
            : "Mark as unpaid"}
      </Button>
      {setStatus.error ? (
        <p role="alert" className="text-xs text-destructive">
          {setStatus.error.message}
        </p>
      ) : null}
    </div>
  );
}

export function DeleteExpenseButton({ expenseId }: { expenseId: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const remove = useMutation(
    trpc.expenses.delete.mutationOptions({
      onSuccess: () => {
        router.push("/expenses");
        router.refresh();
      },
    }),
  );

  return (
    <Button
      size="icon"
      variant="ghost"
      aria-label="Delete expense"
      disabled={remove.isPending}
      onClick={() => remove.mutate({ expenseId })}
      className="size-9 shrink-0 text-muted-foreground hover:text-destructive"
    >
      <Trash2 className="size-4" aria-hidden />
    </Button>
  );
}
