import Link from "next/link";

import { SignOutButton } from "./sign-out-button";
import { TimerChip } from "./timer-chip";

// Spec: design system Topbar - 60px, translucent blurred surface,
// hairline bottom border. The only fixed chrome besides the sidebar.
export function Topbar({
  businessName,
  userName,
}: {
  businessName: string;
  userName: string;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-[var(--topbar-height)] shrink-0 items-center gap-4 border-b bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-[22px] backdrop-blur-[10px] backdrop-saturate-[140%]">
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-medium text-muted-foreground">
          {businessName}
        </span>
      </div>
      {/* Compact nav where the sidebar is hidden */}
      <nav className="flex items-center gap-1 md:hidden">
        <Link
          href="/"
          className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Dashboard
        </Link>
        <Link
          href="/clients"
          className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Clients
        </Link>
        <Link
          href="/projects"
          className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Projects
        </Link>
        <Link
          href="/time"
          className="rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          Time
        </Link>
      </nav>
      <div className="flex-1" />
      <div className="flex items-center gap-2.5">
        <TimerChip />
        <span className="hidden text-sm text-muted-foreground sm:inline">
          {userName}
        </span>
        <SignOutButton />
      </div>
    </header>
  );
}
