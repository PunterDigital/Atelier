"use client";

import { Download } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// "Download receipts" on the expenses page: pick a month, get every receipt
// uploaded to an expense incurred that month as one zip (plus a summary.csv
// manifest) - the bundle to hand to an accountant.
//
// The month boundaries are computed here, in the browser, because incurred
// dates are stored as midnight in the user's local timezone (see
// expense-form.tsx) - a boundary drawn in the server's timezone could drop
// the first or last day of the month.

// Last month: the period most likely being handed over as a whole.
function defaultMonth(): string {
  const now = new Date();
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  return `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
}

export function DownloadReceipts() {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(defaultMonth);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function download() {
    // <input type="month"> falls back to plain text in some browsers, so
    // the value can't be assumed well-formed.
    const match = /^(\d{4})-(\d{2})$/.exec(month.trim());
    if (!match) {
      setError("Enter a month as YYYY-MM, like 2026-07");
      return;
    }
    const year = Number(match[1]);
    const monthIndex = Number(match[2]) - 1;
    if (monthIndex < 0 || monthIndex > 11) {
      setError("Enter a month as YYYY-MM, like 2026-07");
      return;
    }
    const from = new Date(year, monthIndex, 1);
    const to = new Date(year, monthIndex + 1, 1);

    setBusy(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        from: from.toISOString(),
        to: to.toISOString(),
      });
      const res = await fetch(`/api/expenses/receipts?${params}`);
      if (!res.ok) {
        setError(
          res.status === 404
            ? "No expenses with receipts in that month."
            : await res.text(),
        );
        return;
      }
      const url = URL.createObjectURL(await res.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = `expense-receipts-${match[1]}-${match[2]}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setOpen(false);
    } catch {
      setError("Download failed - check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setMonth(defaultMonth());
          setError(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline">
          <Download aria-hidden />
          Download receipts
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Download receipts</DialogTitle>
          <DialogDescription>
            Every receipt from that month&apos;s expenses, zipped together
            with a summary.csv - ready to pass on to your accountant.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          <Label htmlFor="receipts-month">Month</Label>
          <Input
            id="receipts-month"
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            placeholder="YYYY-MM"
            className="w-48"
          />
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
        </div>
        <DialogFooter showCloseButton>
          <Button onClick={download} disabled={busy}>
            {busy ? "Preparing zip..." : "Download zip"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
