import { Users as UsersIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { formatDate } from "@/lib/format";
import { caller } from "@/server/trpc/server";

import { Pager } from "../pager";
import { SearchForm } from "../search-form";

export const metadata: Metadata = {
  title: "Users - System Administration - Clerq",
};

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;

export default async function SystemAdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string }>;
}) {
  const { q, page: pageParam } = await searchParams;
  const page = Math.max(1, Number(pageParam) || 1);
  const { items, total } = await caller.admin.listUsers({
    search: q,
    page,
    pageSize: PAGE_SIZE,
  });

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <h1 className="flex-1 text-2xl">Users</h1>
      </div>

      <SearchForm
        action="/system-admin/users"
        defaultValue={q}
        placeholder="Search by name or email"
      />

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-card px-8 py-12 text-center shadow-sm">
          <span className="mb-2.5 flex size-12 items-center justify-center rounded-full bg-[var(--primary-subtle)] text-[var(--primary-subtle-fg)]">
            <UsersIcon className="size-[26px]" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">No users found</h2>
          <p className="max-w-[40ch] text-sm text-muted-foreground">
            {q ? "Try a different search." : "Nobody has signed up yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
          {items.map((user) => (
            <Link
              key={user.id}
              href={`/system-admin/users/${user.id}`}
              className="flex items-center gap-4 border-b px-4 py-[13px] transition-colors last:border-b-0 hover:bg-muted"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{user.name}</span>
                  {user.isPlatformAdmin && (
                    <span className="rounded-full bg-[var(--primary-subtle)] px-2 py-px text-xs font-semibold text-[var(--primary-subtle-fg)]">
                      Platform admin
                    </span>
                  )}
                  {user.suspended && (
                    <span className="rounded-full bg-[var(--status-overdue-bg)] px-2 py-px text-xs font-semibold text-[var(--status-overdue-fg)]">
                      Suspended
                    </span>
                  )}
                </div>
                <div className="truncate text-sm text-muted-foreground">{user.email}</div>
              </div>
              <span className="shrink-0 text-sm text-muted-foreground">
                {user.businessCount} {user.businessCount === 1 ? "business" : "businesses"}
              </span>
              <span className="w-20 shrink-0 text-right text-sm text-muted-foreground">
                {formatDate(user.createdAt)}
              </span>
            </Link>
          ))}
        </div>
      )}

      <Pager page={page} pageSize={PAGE_SIZE} total={total} basePath="/system-admin/users" q={q} />
    </div>
  );
}
