import type { Metadata } from "next";
import { headers } from "next/headers";
import Link from "next/link";

import { getAuth } from "@/server/auth";
import { caller } from "@/server/trpc/server";

import { TeamManager } from "./team-manager";

export const metadata: Metadata = {
  title: "Team - Clerq",
};

export const dynamic = "force-dynamic";

export default async function TeamPage() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  const { members, invitations, role } = await caller.team.list();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <div className="flex items-center gap-3">
        <Link
          href="/settings"
          className="text-sm text-muted-foreground underline-offset-4 hover:underline"
        >
          Settings
        </Link>
        <span className="text-muted-foreground">/</span>
        <h1 className="text-2xl">Team</h1>
      </div>
      <TeamManager
        members={members}
        invitations={invitations}
        role={role}
        currentUserId={session?.user.id ?? ""}
      />
    </div>
  );
}
