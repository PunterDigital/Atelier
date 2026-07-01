import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
import { UpdateBanner } from "@/components/app-shell/update-banner";
import { getAuth } from "@/server/auth";
import { getActiveMembership } from "@/server/membership";
import { caller } from "@/server/trpc/server";

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
  const membership = await getActiveMembership(session.user.id);
  if (!membership) {
    redirect("/onboarding");
  }
  const businesses = await caller.business.list();

  // Update checking is owner/admin only (and skipped for the cloud instance,
  // and for anyone who has turned it off) - fetched conditionally so the rest
  // of the team never hits the permission gate.
  const updateStatus = membership.permissions.has("settings.manageUpdates")
    ? await caller.system.updateStatus()
    : null;

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar businesses={businesses} userName={session.user.name} />
        {updateStatus?.checked && updateStatus.updateAvailable ? (
          <UpdateBanner
            currentVersion={updateStatus.currentVersion}
            latestVersion={updateStatus.latestVersion}
          />
        ) : null}
        <main className="mx-auto w-full max-w-[var(--content-max)] flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
