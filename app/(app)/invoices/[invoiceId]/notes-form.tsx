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
import { useTRPC } from "@/server/trpc/client";

// Free-text notes printed at the foot of the invoice. Editable while the
// invoice is a draft; saving an empty box clears the notes.
export function NotesForm({
  invoiceId,
  initialNotes,
}: {
  invoiceId: string;
  initialNotes: string | null;
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const [notes, setNotes] = useState(initialNotes ?? "");

  const save = useMutation(
    trpc.invoices.setNotes.mutationOptions({
      onSuccess: () => router.refresh(),
    }),
  );

  const dirty = notes.trim() !== (initialNotes ?? "").trim();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notes</CardTitle>
        <CardDescription>
          Free text printed at the foot of the invoice, above the footer -
          payment terms, a thank-you, a reference.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate({ invoiceId, notes });
          }}
          className="flex flex-col items-end gap-2"
        >
          <textarea
            aria-label="Invoice notes"
            rows={4}
            placeholder="e.g. Payment due within 14 days. Thank you for your business."
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
          <Button type="submit" disabled={!dirty || save.isPending}>
            {save.isPending ? "Saving..." : "Save notes"}
          </Button>
        </form>
        {save.error ? (
          <p role="alert" className="pt-2 text-sm text-destructive">
            {save.error.message}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
