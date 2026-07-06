import type { Metadata } from "next";

import { ErrorView } from "@/components/error-view";

export const metadata: Metadata = {
  title: "Page not found | Clerq",
};

// Shown for any unmatched route and for explicit notFound() calls. Renders
// inside the root layout (fonts + globals), but outside the (app) shell, so
// there's no sidebar/topbar - just the centered notice.
export default function NotFound() {
  return (
    <ErrorView
      code="404"
      title="Page not found"
      description="The page you're looking for doesn't exist or may have been moved."
    />
  );
}
