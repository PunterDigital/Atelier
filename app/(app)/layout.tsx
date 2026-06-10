import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { Sidebar } from "@/components/app-shell/sidebar";
import { Topbar } from "@/components/app-shell/topbar";
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
  const business = await caller.business.current();

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <Topbar businessName={business.name} userName={session.user.name} />
        <main className="mx-auto w-full max-w-[var(--content-max)] flex-1 px-6 py-8">
          {children}
        </main>
      </div>
    </div>
  );
}
