import { Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SearchBar } from "@/components/search-bar";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { caller } from "@/server/trpc/server";

export const metadata: Metadata = {
  title: "Clients - Clerq",
};

export const dynamic = "force-dynamic";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ archived?: string; q?: string }>;
}) {
  const { archived, q } = await searchParams;
  const includeArchived = archived === "1";
  const search = q?.trim() || undefined;
  const clients = await caller.clients.list({ includeArchived, search });

  // Toggling the archived filter keeps the active search term.
  const toggleHref = new URLSearchParams();
  if (!includeArchived) toggleHref.set("archived", "1");
  if (search) toggleHref.set("q", search);
  const toggleQuery = toggleHref.toString();

  // With no clients and no search, this is a first-run business: show the
  // onboarding empty state instead of the search UI.
  const isEmptyBusiness = clients.length === 0 && !search;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <h1 className="flex-1 text-2xl">Clients</h1>
        <Button variant="ghost" size="sm" asChild>
          <Link href={toggleQuery ? `/clients?${toggleQuery}` : "/clients"}>
            {includeArchived ? "Hide archived" : "Show archived"}
          </Link>
        </Button>
        <Button asChild>
          <Link href="/clients/new">New client</Link>
        </Button>
      </div>

      {isEmptyBusiness ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-card px-8 py-12 text-center shadow-sm">
          <span className="mb-2.5 flex size-12 items-center justify-center rounded-full bg-[var(--primary-subtle)] text-[var(--primary-subtle-fg)]">
            <Users className="size-[26px]" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">No clients yet</h2>
          <p className="max-w-[38ch] text-sm text-muted-foreground">
            Add the people and companies you work with - projects and
            invoices will hang off them
          </p>
          <div className="mt-3.5">
            <Button asChild>
              <Link href="/clients/new">Add your first client</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <SearchBar placeholder="Search clients" className="max-w-sm" />

          {clients.length === 0 ? (
            <div className="rounded-lg border bg-card px-8 py-12 text-center text-sm text-muted-foreground shadow-sm">
              No clients match &ldquo;{search}&rdquo;
            </div>
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
              {clients.map((client) => (
                <Link
                  key={client.id}
                  href={`/clients/${client.id}`}
                  className={`flex items-center gap-4 border-b px-4 py-[13px] transition-colors last:border-b-0 hover:bg-muted ${
                    client.archivedAt ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-medium">
                        {client.name}
                      </span>
                      {client.archivedAt ? (
                        <span className="rounded-full bg-[var(--status-draft-bg)] px-2 py-px text-xs font-semibold text-[var(--status-draft-fg)]">
                          Archived
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="shrink-0 text-sm text-muted-foreground">
                    Added {formatDate(client.createdAt)}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
