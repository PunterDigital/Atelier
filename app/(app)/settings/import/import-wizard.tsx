"use client";

import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { parseCsv } from "@/lib/csv";
import { useTRPC } from "@/server/trpc/client";

const selectClassName =
  "h-9 rounded-md border bg-transparent px-3 text-sm shadow-xs outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40";

const FIELDS = [
  { key: "name", label: "Client name", required: true },
  { key: "company", label: "Company", required: false },
  { key: "contactName", label: "Contact name", required: false },
  { key: "contactEmail", label: "Contact email", required: false },
  { key: "vatNumber", label: "VAT number", required: false },
  { key: "notes", label: "Notes", required: false },
] as const;

type FieldKey = (typeof FIELDS)[number]["key"];
type Mapping = Partial<Record<FieldKey, number>>;

// Best-effort initial mapping from common header names; the user always
// confirms or corrects it.
function guessMapping(headers: string[]): Mapping {
  const mapping: Mapping = {};
  const lower = headers.map((h) => h.trim().toLowerCase());
  const find = (...candidates: string[]) =>
    lower.findIndex((h) => candidates.some((c) => h.includes(c)));
  const assign = (key: FieldKey, index: number) => {
    if (index >= 0 && !Object.values(mapping).includes(index)) {
      mapping[key] = index;
    }
  };
  assign("name", find("client name", "client", "name"));
  assign("company", find("company", "organisation", "organization"));
  assign("contactEmail", find("email"));
  assign("contactName", find("contact name", "contact"));
  assign("vatNumber", find("vat", "tax id", "tax number"));
  assign("notes", find("note"));
  return mapping;
}

type ImportRow = {
  name: string;
  company: string | undefined;
  contacts: { name: string; email: string | undefined }[];
  vatNumber: string | null;
  notes: string | undefined;
};

function buildRows(data: string[][], mapping: Mapping): ImportRow[] {
  const nameIndex = mapping.name;
  if (nameIndex === undefined) {
    return [];
  }
  const pick = (row: string[], key: FieldKey) => {
    const index = mapping[key];
    return index === undefined ? "" : (row[index] ?? "").trim();
  };
  return data
    .map((row) => {
      const name = pick(row, "name");
      if (!name) {
        return null;
      }
      const contactName = pick(row, "contactName");
      const contactEmail = pick(row, "contactEmail");
      const contact =
        contactName || contactEmail
          ? [
              {
                name: contactName || contactEmail,
                email: contactEmail || undefined,
              },
            ]
          : [];
      return {
        name,
        company: pick(row, "company") || undefined,
        contacts: contact,
        vatNumber: pick(row, "vatNumber") || null,
        notes: pick(row, "notes") || undefined,
      };
    })
    .filter((row): row is ImportRow => row !== null);
}

export function ImportWizard() {
  const trpc = useTRPC();
  const [headers, setHeaders] = useState<string[]>([]);
  const [data, setData] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Mapping>({});
  const [pasted, setPasted] = useState("");
  const [result, setResult] = useState<{
    created: number;
    skipped: string[];
  } | null>(null);

  function loadCsv(text: string) {
    const parsed = parseCsv(text);
    if (parsed.length < 2) {
      setHeaders([]);
      setData([]);
      return;
    }
    setHeaders(parsed[0]);
    setData(parsed.slice(1));
    setMapping(guessMapping(parsed[0]));
    setResult(null);
  }

  const rows = buildRows(data, mapping);

  const importMutation = useMutation(
    trpc.clients.importMany.mutationOptions(),
  );

  async function runImport() {
    // Chunked so any size of export fits the per-call limit. Goes through
    // the mutation so pending and error states are real - a failed chunk
    // surfaces instead of silently dropping the import.
    let created = 0;
    const skipped: string[] = [];
    try {
      for (let i = 0; i < rows.length; i += 500) {
        const batch = await importMutation.mutateAsync({
          rows: rows.slice(i, i + 500),
        });
        created += batch.created;
        skipped.push(...batch.skipped);
      }
    } catch {
      // importMutation.error renders below; partial progress is safe to
      // retry because existing names are skipped.
      return;
    }
    setResult({ created, skipped });
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Provide the CSV</CardTitle>
          <CardDescription>
            Choose the exported file, or paste the rows straight from a
            spreadsheet (header row first)
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="Choose a CSV file"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                loadCsv(await file.text());
              }
            }}
            className="text-sm text-muted-foreground file:mr-3 file:rounded-md file:border file:bg-transparent file:px-3 file:py-1.5 file:text-sm file:font-medium"
          />
          <textarea
            aria-label="Or paste CSV rows"
            rows={4}
            placeholder={"name,company,email\nNorthwind Studio,Northwind s.r.o.,petra@northwind.test"}
            value={pasted}
            onChange={(e) => {
              setPasted(e.target.value);
              loadCsv(e.target.value);
            }}
            className="rounded-md border bg-transparent px-3 py-2 font-mono text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/40"
          />
        </CardContent>
      </Card>

      {headers.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>2. Map the columns</CardTitle>
            <CardDescription>
              {data.length} data {data.length === 1 ? "row" : "rows"} found
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            {FIELDS.map((field) => (
              <div key={field.key} className="flex flex-col gap-1.5">
                <Label htmlFor={`map-${field.key}`}>
                  {field.label}
                  {field.required ? " (required)" : ""}
                </Label>
                <select
                  id={`map-${field.key}`}
                  value={mapping[field.key] ?? ""}
                  onChange={(e) =>
                    setMapping((prev) => ({
                      ...prev,
                      [field.key]:
                        e.target.value === "" ? undefined : Number(e.target.value),
                    }))
                  }
                  className={selectClassName}
                >
                  <option value="">Not in this file</option>
                  {headers.map((header, index) => (
                    <option key={index} value={index}>
                      {header || `Column ${index + 1}`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {rows.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>3. Preview and import</CardTitle>
            <CardDescription>
              First {Math.min(rows.length, 5)} of {rows.length}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="overflow-hidden rounded-md border">
              {rows.slice(0, 5).map((row, index) => (
                <div
                  key={index}
                  className="flex items-baseline gap-3 border-b px-3 py-2 text-sm last:border-b-0"
                >
                  <span className="font-medium">{row.name}</span>
                  {row.company ? (
                    <span className="text-muted-foreground">{row.company}</span>
                  ) : null}
                  {row.contacts[0]?.email ? (
                    <span className="text-muted-foreground">
                      {row.contacts[0].email}
                    </span>
                  ) : null}
                  {row.vatNumber ? (
                    <span className="text-muted-foreground tabular">
                      VAT {row.vatNumber}
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <Button
                disabled={importMutation.isPending || result !== null}
                onClick={runImport}
              >
                {importMutation.isPending
                  ? "Importing..."
                  : `Import ${rows.length} ${rows.length === 1 ? "client" : "clients"}`}
              </Button>
              {importMutation.error ? (
                <p role="alert" className="text-sm text-destructive">
                  {importMutation.error.message}
                </p>
              ) : null}
            </div>
            {result ? (
              <div className="flex flex-col gap-1 rounded-md bg-[var(--success-subtle)] p-3 text-sm text-[var(--success-subtle-fg)]">
                <p>
                  Imported {result.created}{" "}
                  {result.created === 1 ? "client" : "clients"}
                  {result.skipped.length > 0
                    ? ` - skipped ${result.skipped.length} already here (${result.skipped.slice(0, 5).join(", ")}${result.skipped.length > 5 ? ", ..." : ""})`
                    : ""}
                </p>
                <Link
                  href="/clients"
                  className="font-medium underline-offset-4 hover:underline"
                >
                  Go to clients
                </Link>
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
