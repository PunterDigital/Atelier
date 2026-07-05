"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

export type SettingsTab = {
  href: string;
  label: string;
  // Extra path prefixes that should light this tab up. Lets a deep sub-flow
  // (e.g. the CSV import wizard) keep its parent tab active.
  match?: string[];
};

function isTabActive(tab: SettingsTab, pathname: string): boolean {
  // "/settings" is the General tab and must match exactly, otherwise it would
  // stay active on every settings sub-route.
  const exact = tab.href === "/settings";
  if (exact ? pathname === tab.href : pathname.startsWith(tab.href)) {
    return true;
  }
  return tab.match?.some((prefix) => pathname.startsWith(prefix)) ?? false;
}

// Horizontal, scrollable tab bar for the settings area. Mirrors the sidebar's
// active-state styling (primary-subtle) so the two navs read as one system.
export function SettingsTabs({ tabs }: { tabs: SettingsTab[] }) {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Settings sections"
      className="-mx-1 flex gap-1 overflow-x-auto border-b pb-px"
    >
      {tabs.map((tab) => {
        const active = isTabActive(tab, pathname);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              active &&
                "bg-[var(--primary-subtle)] font-semibold text-[var(--primary-subtle-fg)] hover:bg-[var(--primary-subtle)] hover:text-[var(--primary-subtle-fg)]",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
