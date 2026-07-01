import type { UserBusiness } from "@/server/membership";

import { BusinessSwitcher } from "./business-switcher";
import { MobileNav } from "./mobile-nav";
import { SignOutButton } from "./sign-out-button";
import { TimerChip } from "./timer-chip";

// Spec: design system Topbar - 60px, translucent blurred surface,
// hairline bottom border. The only fixed chrome besides the sidebar.
export function Topbar({
  businesses,
  userName,
  isPlatformAdmin = false,
}: {
  businesses: UserBusiness[];
  userName: string;
  isPlatformAdmin?: boolean;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-[var(--topbar-height)] shrink-0 items-center gap-2 border-b bg-[color-mix(in_srgb,var(--surface)_80%,transparent)] px-3 backdrop-blur-[10px] backdrop-saturate-[140%] sm:gap-4 sm:px-[22px]">
      {/* Hamburger opens the full navigation drawer where the sidebar is hidden */}
      <MobileNav isPlatformAdmin={isPlatformAdmin} />
      <div className="flex min-w-0 flex-col">
        <BusinessSwitcher businesses={businesses} />
      </div>
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
