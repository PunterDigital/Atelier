import { ShieldAlert } from "lucide-react";

import { SignOutButton } from "@/components/app-shell/sign-out-button";

// Rendered instead of the app shell when the signed-in account or its active
// business has been suspended by a platform admin (see server/trpc/init.ts,
// which enforces the same rule at the API layer - this is just the friendly
// page-load version of that FORBIDDEN).
export function SuspendedNotice({
  scope,
  reason,
}: {
  scope: "account" | "business";
  reason: string | null;
}) {
  return (
    <div className="flex h-screen items-center justify-center px-6">
      <div className="flex max-w-md flex-col items-center gap-2 rounded-lg border bg-card px-8 py-12 text-center shadow-sm">
        <span className="mb-2.5 flex size-12 items-center justify-center rounded-full bg-[var(--status-overdue-bg)] text-[var(--status-overdue-fg)]">
          <ShieldAlert className="size-[26px]" aria-hidden />
        </span>
        <h1 className="text-lg font-semibold">
          {scope === "account" ? "Your account has been suspended" : "This business has been suspended"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {reason ?? "Contact your administrator for more information."}
        </p>
        <div className="mt-3.5">
          <SignOutButton />
        </div>
      </div>
    </div>
  );
}
