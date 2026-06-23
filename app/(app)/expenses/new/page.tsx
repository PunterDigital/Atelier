import type { Metadata } from "next";

import { isReceiptScanConfigured } from "@/modules/expenses/ocr";
import { caller } from "@/server/trpc/server";

import { ExpenseForm } from "../expense-form";

export const metadata: Metadata = {
  title: "New expense - Clerq",
};

export const dynamic = "force-dynamic";

export default async function NewExpensePage() {
  // Default the amount to the business's own currency; the user can override
  // per expense (a receipt may be in a different currency).
  const business = await caller.business.current();

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-6">
      <h1 className="text-2xl">New expense</h1>
      <ExpenseForm
        defaultCurrency={business.currency}
        scanEnabled={isReceiptScanConfigured()}
      />
    </div>
  );
}
