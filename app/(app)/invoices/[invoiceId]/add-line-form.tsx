"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTRPC } from "@/server/trpc/client";

// Fixed-amount line for dual-purpose invoices: fixed-fee work, retainers,
// expenses - anything that is not generated from tracked time.
export function AddLineForm({
  invoiceId,
  currency,
}: {
  invoiceId: string;
  currency: string;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");

  const addLine = useMutation(
    trpc.invoices.addLine.mutationOptions({
      onSuccess: () => {
        setDescription("");
        setAmount("");
        router.refresh();
      },
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a line</CardTitle>
        <CardDescription>
          A fixed amount - fixed-fee work, a retainer, an expense
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            addLine.mutate({
              invoiceId,
              description: description.trim(),
              amountMajor: amount.trim(),
            });
          }}
          className="flex flex-wrap items-end gap-2"
        >
          <div className="flex min-w-48 flex-1 flex-col gap-2">
            <Label htmlFor="line-description">Description</Label>
            <Input
              id="line-description"
              required
              placeholder="Discovery workshop (fixed fee)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex w-36 flex-col gap-2">
            <Label htmlFor="line-amount">Amount ({currency})</Label>
            <Input
              id="line-amount"
              required
              inputMode="decimal"
              placeholder="1500.00"
              className="tabular"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={addLine.isPending}>
            {addLine.isPending ? "Adding..." : "Add line"}
          </Button>
        </form>
        {addLine.error ? (
          <p role="alert" className="pt-2 text-sm text-destructive">
            {addLine.error.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
