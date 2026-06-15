import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { caller } from "@/server/trpc/server";

import { ClientForm, type ClientFormValues } from "../../client-form";

export const metadata: Metadata = {
  title: "Edit client - Clerq",
};

export const dynamic = "force-dynamic";

export default async function EditClientPage({
  params,
}: {
  params: Promise<{ clientId: string }>;
}) {
  const { clientId } = await params;
  let initial: ClientFormValues;
  try {
    const client = await caller.clients.get({ clientId });
    initial = {
      name: client.name,
      company: client.company ?? undefined,
      contacts: client.contacts as ClientFormValues["contacts"],
      notes: client.notes ?? undefined,
      vatNumber: client.vatNumber,
      defaultRateMinor: client.defaultRateMinor,
      defaultRateCurrency: client.defaultRateCurrency,
    };
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl">Edit client</h1>
      <ClientForm clientId={clientId} initial={initial} />
    </div>
  );
}
