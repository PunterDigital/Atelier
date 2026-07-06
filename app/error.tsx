"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";

import { ErrorView } from "@/components/error-view";
import { Button } from "@/components/ui/button";

// Route-level error boundary: catches uncaught errors thrown while rendering
// any page in the tree (below the root layout). Must be a client component.
// `reset` re-renders the failed segment; the dashboard link is the escape
// hatch when a retry won't help.
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Surface the error for whatever logging is wired up to the console
    // (and, in production, the digest that ties it to server logs).
    console.error(error);
  }, [error]);

  return (
    <ErrorView
      code="500"
      title="Something went wrong"
      description="An unexpected error occurred on our end. You can try again, or head back to your dashboard."
    >
      <Button variant="outline" onClick={reset}>
        <RotateCw aria-hidden />
        Try again
      </Button>
    </ErrorView>
  );
}
