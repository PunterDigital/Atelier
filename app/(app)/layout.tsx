import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { getDb } from "@/db";
import {
  getBusinessSuspension,
  getUserSuspension,
  isPlatformAdmin,
} from "@/modules/platform/service";
import { getAuth } from "@/server/auth";
import { getActiveMembership } from "@/server/membership";
import { caller } from "@/server/trpc/server";

import { SuspendedNotice } from "./suspended-notice";

// Every page in this group is per-request: the layout itself checks the
// session and reads the DB, so nothing here can be prerendered.
export const dynamic = "force-dynamic";

// The signed-in app shell: sidebar + topbar are the only fixed chrome
// (design system layout rule). Auth and membership are enforced here for
// every page in the group.
export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await getAuth().api.getSession({ headers: await headers() });
  if (!session) {
    redirect("/sign-in");
  }

  // A suspended account never sees the app shell - mirrors the FORBIDDEN
  // server/trpc/init.ts throws on every request, but as a friendly page
  // instead of an error bubbling up from the first tRPC call.
  const userSuspension = await getUserSuspension(getDb(), session.user.id);
  if (userSuspension) {
    return <SuspendedNotice scope="account" reason={userSuspension.reason} />;
  }

  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    redirect("/onboarding");
  }

  const businessSuspension = await getBusinessSuspension(getDb(), membership.businessId);
  if (businessSuspension) {
    return <SuspendedNotice scope="business" reason={businessSuspension.reason} />;
  }

  const [businesses, admin] = await Promise.all([
    caller.business.list(),
    isPlatformAdmin(getDb(), session.user.id),
  ]);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar isPlatformAdmin={admin} />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar businesses={businesses} userName={session.user.name} isPlatformAdmin={admin} />
        <main className="mx-auto w-full max-w-[var(--content-max)] flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
