import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { caller } from "@/server/trpc/server";

import { TasksPanel } from "./tasks-panel";

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
  let tasks;
  try {
    [project, tasks] = await Promise.all([
      caller.projects.get({ projectId }),
      caller.tasks.list({ projectId }),
    ]);
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

      <TasksPanel
        projectId={project.id}
        tasks={tasks.map((t) => ({
          id: t.id,
          title: t.title,
          status: t.status,
          estimateMinutes: t.estimateMinutes,
        }))}
      />
    </div>
  );
}
