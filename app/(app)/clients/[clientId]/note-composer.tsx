"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { useTRPC } from "@/server/trpc/client";

export function NoteComposer({ clientId }: { clientId: string }) {
  const router = useRouter();
  const trpc = useTRPC();
  const [text, setText] = useState("");

  const addNote = useMutation(
    trpc.clients.addNote.mutationOptions({
      onSuccess: () => {
        setText("");
        router.refresh();
      },
    }),
  );

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (text.trim()) {
          addNote.mutate({ clientId, text: text.trim() });
        }
      }}
      className="flex flex-col gap-2"
    >
      <textarea
        aria-label="Add a note"
        rows={2}
        placeholder="Write a note - calls, decisions, anything worth keeping"
        value={text}
        onChange={(event) => setText(event.target.value)}
        className="rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
      />
      {addNote.error ? (
        <p role="alert" className="text-sm text-destructive">
          {addNote.error.message}
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          size="sm"
          disabled={addNote.isPending || text.trim().length === 0}
        >
          {addNote.isPending ? "Adding..." : "Add note"}
        </Button>
      </div>
    </form>
  );
}
