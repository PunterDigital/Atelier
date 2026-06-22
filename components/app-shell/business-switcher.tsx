"use client";

import { useMutation } from "@tanstack/react-query";
import { ChevronsUpDown, Plus } from "lucide-react";
import { DropdownMenu } from "radix-ui";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { useTRPC } from "@/server/trpc/client";
import type { UserBusiness } from "@/server/membership";

// The topbar organization switcher. A user can belong to several businesses
// (clean separation of concerns - one account, several entities); this is how
// they see which one they are in, jump between them, and spin up a new one.
// Server-rendered with the full list, so there is no empty-state flash. On a
// switch or a create we do a full page reload rather than a soft router
// refresh: the active business changes what every query returns, and a soft
// refresh would re-render the server components while leaving the previous
// business's data cached in React Query on the client - so the page would show
// a stale mix. A reload re-fetches the current page cleanly against the now-
// active business and keeps the user where they were.
export function BusinessSwitcher({
  businesses,
}: {
  businesses: UserBusiness[];
}) {
  const trpc = useTRPC();
  const [createOpen, setCreateOpen] = useState(false);

  const active = businesses.find((b) => b.isActive) ?? businesses[0];

  const switchBusiness = useMutation(
    trpc.business.switch.mutationOptions({
      onSuccess: () => window.location.reload(),
    }),
  );

  return (
    <>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 h-auto max-w-[14rem] py-1"
            aria-label="Switch business"
          >
            <span className="min-w-0 truncate text-xs font-medium text-foreground">
              {active?.name ?? "Business"}
            </span>
            <ChevronsUpDown className="text-muted-foreground" />
          </Button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            sideOffset={6}
            className="z-50 min-w-[16rem] rounded-xl bg-popover p-1 text-sm text-popover-foreground ring-1 ring-foreground/10 shadow-md data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95"
          >
            <DropdownMenu.Label className="px-2 py-1.5 text-xs text-muted-foreground">
              Businesses
            </DropdownMenu.Label>
            {businesses.map((business) => (
              <DropdownMenu.Item
                key={business.businessId}
                disabled={business.isActive || switchBusiness.isPending}
                onSelect={() => {
                  if (business.isActive) return;
                  switchBusiness.mutate({ businessId: business.businessId });
                }}
                className={cn(
                  "flex cursor-pointer items-center justify-between gap-3 rounded-lg px-2 py-1.5 outline-none data-[highlighted]:bg-muted data-[disabled]:cursor-default",
                  business.isActive && "data-[disabled]:opacity-100",
                )}
              >
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium text-foreground">
                    {business.name}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {business.roleName}
                  </span>
                </span>
                {business.isActive ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    Current
                  </span>
                ) : null}
              </DropdownMenu.Item>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-border" />
            <DropdownMenu.Item
              onSelect={(event) => {
                // Keep the menu's close from swallowing the dialog open.
                event.preventDefault();
                setCreateOpen(true);
              }}
              className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-foreground outline-none data-[highlighted]:bg-muted"
            >
              <Plus className="text-muted-foreground" />
              Create business
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>

      <CreateBusinessDialog open={createOpen} onOpenChange={setCreateOpen} />
    </>
  );
}

// Create a new business inline. Mirrors the onboarding form's fields and the
// business.create mutation; on success that mutation already makes the new
// business active, so reloading the page lands the user inside it (a full
// reload for the same reason as switching - see BusinessSwitcher).
function CreateBusinessDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const trpc = useTRPC();
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("");

  const create = useMutation(
    trpc.business.create.mutationOptions({
      onSuccess: () => {
        setName("");
        setCurrency("");
        onOpenChange(false);
        window.location.reload();
      },
    }),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create a business</DialogTitle>
          <DialogDescription>
            A separate entity with its own clients, projects and invoices. You
            become its owner and switch to it straight away.
          </DialogDescription>
        </DialogHeader>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            create.mutate({ name, currency });
          }}
          className="flex flex-col gap-4"
        >
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-business-name">Business name</Label>
            <Input
              id="new-business-name"
              required
              placeholder="Studio Brightwood"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-business-currency">Base currency</Label>
            <Input
              id="new-business-currency"
              required
              placeholder="EUR"
              maxLength={3}
              className="uppercase"
              value={currency}
              onChange={(event) => setCurrency(event.target.value)}
            />
            <p className="text-sm text-muted-foreground">
              Three-letter code like EUR, GBP or CZK
            </p>
          </div>
          {create.error ? (
            <p role="alert" className="text-sm text-destructive">
              {create.error.message}
            </p>
          ) : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creating..." : "Create business"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
