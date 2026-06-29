"use client";

import { Menu, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog, VisuallyHidden } from "radix-ui";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { isNavItemActive, navItems, settingsNavItem } from "./nav-items";

// The mobile navigation drawer. The desktop sidebar is hidden below `md`, so on
// small screens the full workspace navigation lives behind this hamburger
// button. Tapping any link closes the drawer so navigation feels immediate.
export function MobileNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  const close = () => setOpen(false);
  const items = [...navItems, settingsNavItem];

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="md:hidden"
          aria-label="Open navigation menu"
        >
          <Menu className="size-5" />
        </Button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/30 backdrop-blur-xs data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 md:hidden" />
        <Dialog.Content
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-[min(20rem,80vw)] flex-col gap-1 border-r bg-card px-3 py-3.5 shadow-lg outline-none md:hidden",
            "data-[state=open]:animate-in data-[state=open]:slide-in-from-left data-[state=closed]:animate-out data-[state=closed]:slide-out-to-left",
          )}
        >
          <VisuallyHidden.Root>
            <Dialog.Title>Navigation</Dialog.Title>
          </VisuallyHidden.Root>
          <div className="flex items-center justify-between gap-2.5 px-2 pb-3.5 pt-1.5">
            <Link href="/" onClick={close}>
              <Image
                src="/brand/clerq-logo.svg"
                alt="Clerq"
                width={104}
                height={28}
                priority
              />
            </Link>
            <Dialog.Close asChild>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close navigation menu"
              >
                <X className="size-5" />
              </Button>
            </Dialog.Close>
          </div>
          <div className="flex flex-1 flex-col gap-0.5 overflow-y-auto">
            <div className="px-2.5 pb-1 pt-3.5 text-xs font-semibold uppercase tracking-[0.04em] text-muted-foreground">
              Workspace
            </div>
            {items.map((item) => {
              const active = isNavItemActive(item.href, pathname);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={close}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-2.5 py-2.5 text-sm font-medium text-muted-foreground transition-colors",
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
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
