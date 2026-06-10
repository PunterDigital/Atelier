import type { Metadata } from "next";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { caller } from "@/server/trpc/server";

import { ProjectForm } from "../project-form";

export const metadata: Metadata = {
  title: "New project - Atelier",
};

export const dynamic = "force-dynamic";

export default async function NewProjectPage() {
  const clients = await caller.clients.list();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl">New project</h1>
      {clients.length === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border bg-card p-6 shadow-sm">
          <p className="text-sm text-muted-foreground">
            Projects belong to a client - add your first client and the
            project comes next
          </p>
          <Button asChild>
            <Link href="/clients/new">Add a client</Link>
          </Button>
        </div>
      ) : (
        <ProjectForm
          clients={clients.map((c) => ({ id: c.id, name: c.name }))}
        />
      )}
    </div>
  );
}
