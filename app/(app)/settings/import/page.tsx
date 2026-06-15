import type { Metadata } from "next";

import { ImportWizard } from "./import-wizard";

export const metadata: Metadata = {
  title: "Import clients - Clerq",
};

export const dynamic = "force-dynamic";

export default function ImportPage() {
  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-2xl">Import clients</h1>
        <p className="text-muted-foreground">
          Bring clients over from any tool that exports CSV - AndCo, Invoice
          Ninja, FreshBooks, a spreadsheet. Map the columns, check the
          preview, import. Names that already exist are skipped, so
          re-running is safe.
        </p>
      </div>
      <ImportWizard />
    </div>
  );
}
