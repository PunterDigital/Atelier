import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { caller } from "@/server/trpc/server";

import { ProjectForm, type ProjectFormValues } from "../../project-form";

export const metadata: Metadata = {
  title: "Edit project - Atelier",
};

export const dynamic = "force-dynamic";

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  let initial: ProjectFormValues;
  try {
    const project = await caller.projects.get({ projectId });
    initial = {
      name: project.name,
      clientId: project.clientId,
      status: project.status,
      dueDate: project.dueDate,
    };
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
  const clients = await caller.clients.list();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl">Edit project</h1>
      <ProjectForm
        projectId={projectId}
        initial={initial}
        clients={clients.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
