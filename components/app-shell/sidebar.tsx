"use client";

import {
  Clock,
  FolderKanban,
  Home,
  ReceiptText,
  Settings,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/projects", label: "Projects", icon: FolderKanban },
  { href: "/time", label: "Timesheet", icon: Clock },
  { href: "/invoices", label: "Invoices", icon: ReceiptText },
  { href: "/expenses", label: "Expenses", icon: Wallet },
  { href: "/reports", label: "Reports", icon: TrendingUp },
];

// Spec: design system Sidebar - 244px rail, surface bg, hairline right
// border, items radius-md, hover surface-muted, active primary-subtle.
export function Sidebar() {
  const pathname = usePathname();

  return (
    <nav className="hidden h-full w-[var(--sidebar-width)] shrink-0 flex-col gap-1 border-r bg-card px-3 py-3.5 md:flex">
      <div className="flex items-center gap-2.5 px-2 pb-3.5 pt-1.5">
        <Link href="/">
          <Image
            src="/brand/clerq-logo.svg"
            alt="Clerq"
            width={104}
            height={28}
            priority
          />
        </Link>
      </div>
      <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
        <div className="px-2.5 pb-1 pt-3.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
          Workspace
        </div>
        {navItems.map((item) => {
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors",
                "hover:bg-muted hover:text-foreground",
                active &&
                  "bg-[var(--primary-subtle)] font-semibold text-[var(--primary-subtle-fg)] hover:bg-[var(--primary-subtle)] hover:text-[var(--primary-subtle-fg)]",
              )}
            >
              <item.icon className="size-[18px] shrink-0" aria-hidden />
              <span className="truncate">{item.label}</span>
            </Link>
          );
        })}
      </div>
      <div className="border-t pt-2.5">
        <Link
          href="/settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className={cn(
            "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground",
            pathname.startsWith("/settings") &&
              "bg-[var(--primary-subtle)] font-semibold text-[var(--primary-subtle-fg)] hover:bg-[var(--primary-subtle)] hover:text-[var(--primary-subtle-fg)]",
          )}
        >
          <Settings className="size-[18px] shrink-0" aria-hidden />
          <span className="truncate">Settings</span>
        </Link>
      </div>
    </nav>
  );
}
