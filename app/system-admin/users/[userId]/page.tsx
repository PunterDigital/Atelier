import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatDateTime } from "@/lib/format";
import { getAuth } from "@/server/auth";
import { caller } from "@/server/trpc/server";

import { AdminToggleControl } from "./admin-toggle-control";
import { SuspendUserControl } from "./suspend-user-control";

export const metadata: Metadata = {
  title: "User - System Administration - Clerq",
};

export const dynamic = "force-dynamic";

async function loadUser(userId: string) {
  try {
    return await caller.admin.getUser({ userId });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}

export default async function SystemAdminUserDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  const { userId } = await params;
  const [user, session] = await Promise.all([
    loadUser(userId),
    getAuth().api.getSession({ headers: await headers() }),
  ]);

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/system-admin/users"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Users
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl">{user.name}</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          <Row label="Email" value={user.email} />
          <Row label="Email verified" value={user.emailVerified ? "Yes" : "No"} />
          <Row label="Signed up" value={formatDate(user.createdAt)} />
          <Row
            label="Status"
            value={
              user.suspension
                ? `Suspended ${formatDateTime(user.suspension.suspendedAt)}${
                    user.suspension.reason ? ` - ${user.suspension.reason}` : ""
                  }`
                : "Active"
            }
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Businesses</CardTitle>
        </CardHeader>
        <CardContent>
          {user.businesses.length === 0 ? (
            <p className="text-sm text-muted-foreground">Not a member of any business.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {user.businesses.map((b) => (
                <li key={b.businessId} className="flex items-center justify-between text-sm">
                  <Link
                    href={`/system-admin/businesses/${b.businessId}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {b.name}
                  </Link>
                  <span className="text-muted-foreground">{b.roleName}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Moderation</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SuspendUserControl userId={user.id} suspended={!!user.suspension} />
          <AdminToggleControl
            userId={user.id}
            isPlatformAdmin={user.isPlatformAdmin}
            isSelf={session?.user.id === user.id}
          />
        </CardContent>
      </Card>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
