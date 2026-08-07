import { unzipSync, strFromU8 } from "fflate";
import { describe, expect, it } from "vitest";

import {
  buildReceiptsArchive,
  receiptEntryName,
  receiptsSummaryCsv,
  type ReceiptRow,
} from "./receipts-archive";

const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/1aHAAAAAElFTkSuQmCC";

function row(overrides: Partial<ReceiptRow> = {}): ReceiptRow {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    description: "Adobe subscription",
    amountMinor: 4999,
    currency: "EUR",
    vendor: "Adobe",
    category: "Software",
    status: "paid",
    incurredAt: new Date(2026, 6, 14), // 14 July 2026, local time
    receiptDataUrl: `data:image/png;base64,${PNG_BASE64}`,
    receiptFilename: "invoice.png",
    receiptMimeType: "image/png",
    ...overrides,
  };
}

describe("receiptEntryName", () => {
  it("prefixes the incurred date and keeps the uploaded name's stem", () => {
    expect(receiptEntryName(row(), new Set())).toBe("2026-07-14 invoice.png");
  });

  it("derives the extension from the mime type, not the uploaded name", () => {
    const name = receiptEntryName(
      row({ receiptFilename: "scan.exe", receiptMimeType: "application/pdf" }),
      new Set(),
    );
    expect(name).toBe("2026-07-14 scan.pdf");
  });

  it("falls back to the description when the filename sanitises to nothing", () => {
    const name = receiptEntryName(
      row({ receiptFilename: "///" }),
      new Set(),
    );
    expect(name).toBe("2026-07-14 Adobe subscription.png");
  });

  it("strips path separators and control characters from uploaded names", () => {
    const name = receiptEntryName(
      row({ receiptFilename: "../../etc:pass*wd?.png" }),
      new Set(),
    );
    expect(name).not.toMatch(/[\\/:*?]/);
    expect(name.startsWith("2026-07-14 ")).toBe(true);
  });

  it("numbers colliding names instead of overwriting", () => {
    const taken = new Set<string>();
    expect(receiptEntryName(row(), taken)).toBe("2026-07-14 invoice.png");
    expect(receiptEntryName(row(), taken)).toBe("2026-07-14 invoice (2).png");
    expect(receiptEntryName(row(), taken)).toBe("2026-07-14 invoice (3).png");
  });
});

describe("receiptsSummaryCsv", () => {
  it("lists one line per receipt with the amount in major units", () => {
    const csv = receiptsSummaryCsv([
      { row: row(), name: "2026-07-14 invoice.png" },
    ]);
    const [header, line] = csv.trim().split("\r\n");
    expect(header).toBe(
      "date,description,vendor,category,amount,currency,status,file",
    );
    expect(line).toBe(
      "2026-07-14,Adobe subscription,Adobe,Software,49.99,EUR,paid,2026-07-14 invoice.png",
    );
  });

  it("quotes fields containing commas and doubles embedded quotes", () => {
    const csv = receiptsSummaryCsv([
      {
        row: row({ description: 'Taxi, airport "express"', vendor: null }),
        name: "2026-07-14 invoice.png",
      },
    ]);
    expect(csv).toContain('"Taxi, airport ""express"""');
  });
});

describe("buildReceiptsArchive", () => {
  it("produces a zip with each receipt's bytes and a summary.csv", () => {
    const archive = buildReceiptsArchive([
      row(),
      row({
        id: "00000000-0000-0000-0000-000000000002",
        description: "Train ticket",
        receiptFilename: "ticket.png",
        incurredAt: new Date(2026, 6, 20),
      }),
    ]);

    const files = unzipSync(archive);
    expect(Object.keys(files).sort()).toEqual([
      "2026-07-14 invoice.png",
      "2026-07-20 ticket.png",
      "summary.csv",
    ]);
    expect(files["2026-07-14 invoice.png"]).toEqual(
      new Uint8Array(Buffer.from(PNG_BASE64, "base64")),
    );
    const csv = strFromU8(files["summary.csv"]);
    expect(csv).toContain("2026-07-14 invoice.png");
    expect(csv).toContain("2026-07-20 ticket.png");
  });

  it("skips rows whose data URL is missing or malformed", () => {
    const archive = buildReceiptsArchive([
      row(),
      row({
        id: "00000000-0000-0000-0000-000000000003",
        receiptDataUrl: "not-a-data-url",
        receiptFilename: "broken.png",
      }),
    ]);
    const files = unzipSync(archive);
    expect(Object.keys(files).sort()).toEqual([
      "2026-07-14 invoice.png",
      "summary.csv",
    ]);
    expect(strFromU8(files["summary.csv"])).not.toContain("broken");
  });
});
