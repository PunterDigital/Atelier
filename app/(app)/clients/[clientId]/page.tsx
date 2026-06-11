import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { StatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDateTime } from "@/lib/format";
import { caller } from "@/server/trpc/server";

import { ArchiveButton } from "./archive-button";
import { NoteComposer } from "./note-composer";

export const metadata: Metadata = {
  title: "Client - Atelier",
};

export const dynamic = "force-dynamic";

type Contact = { name: string; email?: string; role?: string };

const activityLabels: Record<string, string> = {
  note: "Note",
  client_created: "Client created",
  client_updated: "Details updated",
  client_archived: "Archived",
  client_unarchived: "Restored from archive",
  project_created: "Project created",
};

async function load(clientId: string) {
  try {
    const [client, activity, projects] = await Promise.all([
      caller.clients.get({ clientId }),
      caller.clients.activity({ clientId }),
      caller.projects.list({ clientId }),
    ]);
    return { client, activity, projects };
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
}

export default async function ClientDetailPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  const { client, activity, projects } = await load(clientId);
  const contacts = client.contacts as Contact[];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="truncate text-2xl">{client.name}</h1>
            {client.archivedAt ? (
              <span className="rounded-full bg-[var(--status-draft-bg)] px-2 py-px text-xs font-semibold text-[var(--status-draft-fg)]">
                Archived
              </span>
            ) : null}
          </div>
          {client.company ? (
            <p className="text-muted-foreground">{client.company}</p>
          ) : null}
        </div>
        <Button variant="outline" asChild>
          <Link href={`/clients/${client.id}/edit`}>Edit</Link>
        </Button>
        <ArchiveButton
          clientId={client.id}
          archived={Boolean(client.archivedAt)}
        />
      </div>

      {client.archivedAt ? (
        <div className="rounded-md border border-[var(--warning-subtle-fg)]/25 bg-[var(--warning-subtle)] px-4 py-3 text-sm text-[var(--warning-subtle-fg)]">
          This client is archived - they no longer appear in the clients
          list and cannot be picked for new projects or invoices. Restore
          them to work together again.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Activity</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <NoteComposer clientId={client.id} />
              {activity.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nothing here yet
                </p>
              ) : (
                <ul className="flex flex-col">
                  {activity.map((item) => (
                    <li
                      key={item.id}
                      className="flex flex-col gap-0.5 border-b py-3 last:border-b-0"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium">
                          {activityLabels[item.type] ?? item.type}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(item.at)}
                        </span>
                      </div>
                      {item.type === "note" ? (
                        <p className="whitespace-pre-wrap text-sm text-foreground">
                          {(item.payload as { text: string }).text}
                        </p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Projects</CardTitle>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No projects yet
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {projects.map((project) => (
                    <li key={project.id} className="flex items-center gap-2">
                      <Link
                        href={`/projects/${project.id}`}
                        className="min-w-0 flex-1 truncate text-sm font-medium underline-offset-4 hover:underline"
                      >
                        {project.name}
                      </Link>
                      <StatusPill status={project.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Contacts</CardTitle>
            </CardHeader>
            <CardContent>
              {contacts.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No contacts yet
                </p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {contacts.map((contact, index) => (
                    <li key={index} className="flex flex-col">
                      <span className="text-sm font-medium">
                        {contact.name}
                        {contact.role ? (
                          <span className="text-muted-foreground">
                            {" "}
                            - {contact.role}
                          </span>
                        ) : null}
                      </span>
                      {contact.email ? (
                        <a
                          href={`mailto:${contact.email}`}
                          className="text-sm text-primary underline-offset-4 hover:underline"
                        >
                          {contact.email}
                        </a>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {client.notes ? (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap text-sm">{client.notes}</p>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>
    </div>
  );
}
