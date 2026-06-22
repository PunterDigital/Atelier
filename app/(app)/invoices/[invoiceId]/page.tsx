import { TRPCError } from "@trpc/server";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { InvoiceStatusPill } from "@/components/status-pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate, formatMoney } from "@/lib/format";
import { caller } from "@/server/trpc/server";

import { AddLineForm } from "./add-line-form";
import { GeneratePanel } from "./generate-panel";
import { InvoiceActions, RemoveLineButton } from "./invoice-actions";

export const metadata: Metadata = {
  title: "Invoice - Clerq",
};

export const dynamic = "force-dynamic";

export default async function InvoiceDetailPage({
  params,
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const { invoiceId } = await params;
  let invoice;
  try {
    invoice = await caller.invoices.get({ invoiceId });
  } catch (error) {
    if (error instanceof TRPCError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }
  const [client, projects] = await Promise.all([
    caller.clients.get({ clientId: invoice.clientId }),
    caller.projects.list({ clientId: invoice.clientId }),
  ]);
  const isDraft = invoice.status === "draft";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl tabular">
              {invoice.number ?? "Draft invoice"}
            </h1>
            <InvoiceStatusPill status={invoice.status} />
          </div>
          <p className="text-muted-foreground">
            <Link
              href={`/clients/${invoice.clientId}`}
              className="underline-offset-4 hover:underline"
            >
              {client.name}
            </Link>
            {invoice.issueDate
              ? ` - issued ${formatDate(invoice.issueDate)}`
              : null}
            {invoice.dueDate ? ` - due ${formatDate(invoice.dueDate)}` : null}
          </p>
        </div>
        <div className="flex items-start gap-2">
          {/* The document exists once issued; drafts are edited, not sent */}
          {invoice.status !== "draft" ? (
            <Button variant="outline" asChild>
              <a href={`/api/invoices/${invoice.id}/pdf`} download>
                Download PDF
              </a>
            </Button>
          ) : null}
          <InvoiceActions
            invoiceId={invoice.id}
            status={invoice.status}
            hasLines={invoice.lines.length > 0}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Lines</CardTitle>
            </CardHeader>
            <CardContent>
              {invoice.lines.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No lines yet - pull in unbilled time below
                </p>
              ) : (
                <ul className="flex flex-col">
                  {invoice.lines.map((line) => (
                    <li
                      key={line.id}
                      className="flex items-start gap-3 border-b py-3 last:border-b-0"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-line text-sm font-medium">
                          {line.description}
                        </p>
                        <p className="text-sm text-muted-foreground tabular">
                          {line.quantity
                            ? `${Number(line.quantity).toFixed(2)} h`
                            : null}
                          {line.quantity && line.unitPriceMinor != null
                            ? " x "
                            : null}
                          {line.unitPriceMinor != null
                            ? `${formatMoney(line.unitPriceMinor, invoice.currency)}/h`
                            : null}
                        </p>
                        {line.sourceCurrency &&
                        line.sourceTotalMinor != null &&
                        line.fxRate ? (
                          <p className="text-xs text-muted-foreground tabular">
                            Converted from{" "}
                            {formatMoney(line.sourceTotalMinor, line.sourceCurrency)}{" "}
                            at {line.fxRate} ({line.fxSource === "ecb" ? "ECB" : "manual"}{" "}
                            rate)
                          </p>
                        ) : null}
                      </div>
                      <span className="shrink-0 text-sm font-medium tabular">
                        {formatMoney(line.totalMinor, invoice.currency)}
                      </span>
                      {isDraft ? <RemoveLineButton lineId={line.id} /> : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {isDraft ? (
            <>
              <AddLineForm invoiceId={invoice.id} currency={invoice.currency} />
              <GeneratePanel
                invoiceId={invoice.id}
                invoiceCurrency={invoice.currency}
                projects={projects.map((p) => ({ id: p.id, name: p.name }))}
              />
            </>
          ) : null}
        </div>

        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Totals</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular">
                  {formatMoney(invoice.subtotalMinor, invoice.currency)}
                </span>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-muted-foreground">
                  {invoice.taxTreatment === "standard"
                    ? `VAT ${invoice.taxRatePercent}%`
                    : "VAT"}
                </span>
                <span className="tabular">
                  {formatMoney(invoice.taxMinor, invoice.currency)}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t pt-2 text-sm font-semibold">
                <span>Total</span>
                <span className="tabular">
                  {formatMoney(invoice.totalMinor, invoice.currency)}
                </span>
              </div>
              {invoice.taxNote ? (
                <p className="pt-1 text-xs text-muted-foreground">
                  {invoice.taxNote}
                </p>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
