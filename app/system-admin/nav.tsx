"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const items = [
  { href: "/system-admin", label: "Overview" },
  { href: "/system-admin/users", label: "Users" },
  { href: "/system-admin/businesses", label: "Businesses" },
] as const;

export function SystemAdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex items-center gap-1">
      {items.map((item) => {
        const active =
          item.href === "/system-admin"
            ? pathname === item.href
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-sm font-medium text-muted-foreground transition-colors",
              "hover:bg-muted hover:text-foreground",
              active &&
                "bg-[var(--primary-subtle)] font-semibold text-[var(--primary-subtle-fg)] hover:bg-[var(--primary-subtle)] hover:text-[var(--primary-subtle-fg)]",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
