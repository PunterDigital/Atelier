import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth } from "@/server/auth";
import { getActiveMembership } from "@/server/membership";
import { caller } from "@/server/trpc/server";

// Per-request: session check + DB lookup, never prerenderable.
export const dynamic = "force-dynamic";

// Placeholder home: routes the signed-out to sign-in and the
// business-less to onboarding. The real dashboard is a Phase 1 screen and
// gets its own design review.
export default async function Home() {
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
    <main className="mx-auto flex w-full max-w-[var(--content-max)] flex-1 flex-col gap-2 px-6 py-12">
      <h1 className="text-2xl">{business.name}</h1>
      <p className="text-muted-foreground">
        You&apos;re in. Clients, projects and time tracking are on their way -
        this is a pre-alpha instance.
      </p>
    </main>
  );
}
