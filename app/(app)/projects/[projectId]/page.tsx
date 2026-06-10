import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/format";
import { caller } from "@/server/trpc/server";

export const metadata: Metadata = {
  title: "Project - Atelier",
};

export const dynamic = "force-dynamic";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  let project;
  try {
    project = await caller.projects.get({ projectId });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-2xl">{project.name}</h1>
            <StatusPill status={project.status} />
          </div>
          <p className="text-muted-foreground">
            <Link
              href={`/clients/${project.clientId}`}
              className="underline-offset-4 hover:underline"
            >
              {project.clientName}
            </Link>
            {project.dueDate ? ` - due ${formatDate(project.dueDate)}` : null}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link href={`/projects/${project.id}/edit`}>Edit</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Tasks land here next - board and list views are on the way
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
