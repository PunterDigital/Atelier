import { FolderKanban } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { SearchBar } from "@/components/search-bar";
import { StatusPill, TaskStatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import { caller } from "@/server/trpc/server";

export const metadata: Metadata = {
  title: "Projects - Clerq",
};

export const dynamic = "force-dynamic";

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const search = q?.trim() || undefined;
  // Tasks are only searched, never listed in full - the projects page
  // isn't a task index, it just surfaces matching tasks while searching.
  const [projects, tasks] = await Promise.all([
    caller.projects.list({ search }),
    search ? caller.tasks.search({ search }) : Promise.resolve([]),
  ]);

  const isEmptyBusiness = projects.length === 0 && !search;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-4">
        <h1 className="flex-1 text-2xl">Projects</h1>
        <Button asChild>
          <Link href="/projects/new">New project</Link>
        </Button>
      </div>

      {isEmptyBusiness ? (
        <div className="flex flex-col items-center gap-1.5 rounded-lg border bg-card px-8 py-12 text-center shadow-sm">
          <span className="mb-2.5 flex size-12 items-center justify-center rounded-full bg-[var(--primary-subtle)] text-[var(--primary-subtle-fg)]">
            <FolderKanban className="size-[26px]" aria-hidden />
          </span>
          <h2 className="text-lg font-semibold">No projects yet</h2>
          <p className="max-w-[38ch] text-sm text-muted-foreground">
            Projects collect tasks and tracked time for a client - invoices
            are built from them
          </p>
          <div className="mt-3.5">
            <Button asChild>
              <Link href="/projects/new">Create your first project</Link>
            </Button>
          </div>
        </div>
      ) : (
        <>
          <SearchBar
            placeholder="Search projects and tasks"
            className="max-w-sm"
          />

          {search ? (
            projects.length === 0 && tasks.length === 0 ? (
              <div className="rounded-lg border bg-card px-8 py-12 text-center text-sm text-muted-foreground shadow-sm">
                Nothing matches &ldquo;{search}&rdquo;
              </div>
            ) : (
              <div className="flex flex-col gap-6">
                {projects.length > 0 ? (
                  <section className="flex flex-col gap-2">
                    <h2 className="text-sm font-semibold text-muted-foreground">
                      Projects
                    </h2>
                    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
                      {projects.map((project) => (
                        <ProjectRow key={project.id} project={project} />
                      ))}
                    </div>
                  </section>
                ) : null}

                {tasks.length > 0 ? (
                  <section className="flex flex-col gap-2">
                    <h2 className="text-sm font-semibold text-muted-foreground">
                      Tasks
                    </h2>
                    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
                      {tasks.map((task) => (
                        <Link
                          key={task.id}
                          href={`/projects/${task.projectId}`}
                          className="flex items-center gap-4 border-b px-4 py-[13px] transition-colors last:border-b-0 hover:bg-muted"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="truncate text-sm font-medium">
                              {task.title}
                            </div>
                            <div className="truncate text-sm text-muted-foreground">
                              {task.projectName} · {task.clientName}
                            </div>
                          </div>
                          <TaskStatusPill status={task.status} />
                        </Link>
                      ))}
                    </div>
                  </section>
                ) : null}
              </div>
            )
          ) : (
            <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
              {projects.map((project) => (
                <ProjectRow key={project.id} project={project} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

type ProjectListItem = Awaited<
  ReturnType<typeof caller.projects.list>
>[number];

function ProjectRow({ project }: { project: ProjectListItem }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex items-center gap-4 border-b px-4 py-[13px] transition-colors last:border-b-0 hover:bg-muted"
    >
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{project.name}</div>
        <div className="truncate text-sm text-muted-foreground">
          {project.clientName}
        </div>
      </div>
      {project.dueDate ? (
        <span className="shrink-0 text-sm text-muted-foreground">
          Due {formatDate(project.dueDate)}
        </span>
      ) : null}
      <StatusPill status={project.status} />
    </Link>
  );
}
