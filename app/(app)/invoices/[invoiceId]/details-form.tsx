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

// A stored timestamp -> the yyyy-mm-dd a date input expects. Dates are kept at
// UTC midnight, so the UTC calendar day is the one to show.
function toDateInput(value: Date | null): string {
  return value ? value.toISOString().slice(0, 10) : "";
}

// A yyyy-mm-dd from a date input -> a UTC-midnight Date (matching how the new
// invoice form stores these), or null when the field is empty.
function fromDateInput(value: string): Date | null {
  return value ? new Date(`${value}T00:00:00.000Z`) : null;
}

// Editable dated metadata on a draft: the issue date used (and printed) when
// the invoice is issued - handy for backdating a re-issued copy - plus the
// due date and the optional billing period.
export function DetailsForm({
  invoiceId,
  issueDate,
  dueDate,
  periodStart,
  periodEnd,
}: {
  invoiceId: string;
  issueDate: Date | null;
  dueDate: Date | null;
  periodStart: Date | null;
  periodEnd: Date | null;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const [issue, setIssue] = useState(toDateInput(issueDate));
  const [due, setDue] = useState(toDateInput(dueDate));
  const [start, setStart] = useState(toDateInput(periodStart));
  const [end, setEnd] = useState(toDateInput(periodEnd));

  const save = useMutation(
    trpc.invoices.updateDetails.mutationOptions({
      onSuccess: () => router.refresh(),
    }),
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Details</CardTitle>
        <CardDescription>
          The issue date is used (and printed) when you issue this draft - leave
          it blank to issue at today&apos;s date.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({
              invoiceId,
              issueDate: fromDateInput(issue),
              dueDate: fromDateInput(due),
              periodStart: fromDateInput(start),
              periodEnd: fromDateInput(end),
            });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-wrap gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="issue-date">Issue date</Label>
              <Input
                id="issue-date"
                type="date"
                value={issue}
                onChange={(e) => setIssue(e.target.value)}
              />
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="due-date">Due date</Label>
              <Input
                id="due-date"
                type="date"
                value={due}
                onChange={(e) => setDue(e.target.value)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <Label>Billing period (optional)</Label>
            <div className="flex items-center gap-2">
              <Input
                aria-label="Billing period start"
                type="date"
                value={start}
                max={end || undefined}
                onChange={(e) => setStart(e.target.value)}
              />
              <span className="text-sm text-muted-foreground">to</span>
              <Input
                aria-label="Billing period end"
                type="date"
                value={end}
                min={start || undefined}
                onChange={(e) => setEnd(e.target.value)}
              />
            </div>
          </div>

          {save.error ? (
            <p role="alert" className="text-sm text-destructive">
              {save.error.message}
            </p>
          ) : null}

          <div className="flex justify-end">
            <Button type="submit" disabled={save.isPending}>
              {save.isPending ? "Saving..." : "Save details"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
