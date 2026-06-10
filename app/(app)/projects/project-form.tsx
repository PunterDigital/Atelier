"use client";

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { RateFields } from "@/components/rate-fields";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { majorToMinor, minorToMajor } from "@/modules/billing/currency";
import { useTRPC } from "@/server/trpc/client";

export type ProjectFormValues = {
  name: string;
  clientId: string;
  status: "active" | "on_hold" | "completed";
  dueDate: Date | null;
  defaultRateMinor?: number | null;
  defaultRateCurrency?: string | null;
};

const selectClassName =
  "h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

function toDateInputValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function ProjectForm({
  projectId,
  initial,
  clients,
}: {
  projectId?: string;
  initial?: ProjectFormValues;
  clients: { id: string; name: string }[];
}) {
  const router = useRouter();
  const trpc = useTRPC();
  const [name, setName] = useState(initial?.name ?? "");
  const [clientId, setClientId] = useState(
    initial?.clientId ?? clients[0]?.id ?? "",
  );
  const [status, setStatus] = useState<ProjectFormValues["status"]>(
    initial?.status ?? "active",
  );
  const [dueDate, setDueDate] = useState(
    toDateInputValue(initial?.dueDate ?? null),
  );
  const [rate, setRate] = useState(
    initial?.defaultRateMinor != null && initial.defaultRateCurrency
      ? minorToMajor(initial.defaultRateMinor, initial.defaultRateCurrency)
      : "",
  );
  const [rateCurrency, setRateCurrency] = useState(
    initial?.defaultRateCurrency ?? "",
  );
  const [rateError, setRateError] = useState<string | null>(null);

  const create = useMutation(
    trpc.projects.create.mutationOptions({
      onSuccess: (created) => {
        router.push(`/projects/${created.id}`);
        router.refresh();
      },
    }),
  );
  const update = useMutation(
    trpc.projects.update.mutationOptions({
      onSuccess: () => {
        router.push(`/projects/${projectId}`);
        router.refresh();
      },
    }),
  );
  const mutation = projectId ? update : create;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setRateError(null);
    let defaultRateMinor: number | null = null;
    let defaultRateCurrency: string | null = null;
    if (rate.trim()) {
      const code = rateCurrency.trim().toUpperCase();
      if (!/^[A-Z]{3}$/.test(code)) {
        setRateError("Use a three-letter currency code like EUR");
        return;
      }
      defaultRateMinor = majorToMinor(rate, code);
      if (defaultRateMinor === null) {
        setRateError(`That rate has more decimal places than ${code} allows`);
        return;
      }
      defaultRateCurrency = code;
    }
    const data: ProjectFormValues = {
      name,
      clientId,
      status,
      dueDate: dueDate ? new Date(`${dueDate}T00:00:00.000Z`) : null,
      defaultRateMinor,
      defaultRateCurrency,
    };
    if (projectId) {
      update.mutate({ projectId, data });
    } else {
      create.mutate(data);
    }
  }

  return (
    <Card>
      <CardContent>
        <form onSubmit={submit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              required
              placeholder="Website rebuild"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="client">Client</Label>
            <select
              id="client"
              required
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              className={selectClassName}
            >
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-4">
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="status">Status</Label>
              <select
                id="status"
                value={status}
                onChange={(e) =>
                  setStatus(e.target.value as ProjectFormValues["status"])
                }
                className={selectClassName}
              >
                <option value="active">Active</option>
                <option value="on_hold">On hold</option>
                <option value="completed">Completed</option>
              </select>
            </div>
            <div className="flex flex-1 flex-col gap-2">
              <Label htmlFor="dueDate">Due date</Label>
              <Input
                id="dueDate"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>

          <RateFields
            rate={rate}
            currency={rateCurrency}
            onRateChange={setRate}
            onCurrencyChange={setRateCurrency}
          />
          {rateError ? (
            <p role="alert" className="text-sm text-destructive">
              {rateError}
            </p>
          ) : null}

          {mutation.error ? (
            <p role="alert" className="text-sm text-destructive">
              {mutation.error.message}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button type="submit" disabled={mutation.isPending}>
              {projectId
                ? mutation.isPending
                  ? "Saving..."
                  : "Save changes"
                : mutation.isPending
                  ? "Creating..."
                  : "Create project"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
