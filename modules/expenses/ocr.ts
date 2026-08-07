import { z } from "zod";

// Receipt OCR: hand a receipt photo to a vision-capable model on OpenRouter and
// get back the fields the expense form needs. Server-side only (it holds the
// OpenRouter key), but deliberately free of `import "server-only"` so the unit
// suite can import it directly with an injected fetch - same approach as
// service.ts.
//
// The model call is gated entirely on OPENROUTER_API_KEY: no key, no feature.
// The receipt image is sent to OpenRouter when (and only when) the user clicks
// scan, so the data leaves the instance solely on an explicit, per-receipt
// action.

// OpenRouter exposes an OpenAI-compatible API under /api/v1. Self-hosters can
// point OPENROUTER_BASE_URL at a compatible proxy/gateway; we append the chat
// path to it.
const DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
const CHAT_COMPLETIONS_PATH = "/chat/completions";

// Qwen3.7 Flash is cheap, fast and vision-capable. Overridable for self-hosters
// who prefer another vision model (any OpenRouter model that accepts images).
const DEFAULT_MODEL = "qwen/qwen3.7-flash";

// OpenRouter attributes requests to the calling app from these headers, which is
// how Clerq shows up on its dashboards. They name Clerq itself rather than the
// individual instance, so there's nothing per-deployment to configure.
const APP_URL = "https://useclerq.net";
const APP_NAME = "Clerq";

// Vision models take images, not PDFs - the form only offers scanning for these.
export type ScannableMime = "image/png" | "image/jpeg";

export type ReceiptScanConfig = {
  apiKey: string;
  model: string;
  baseUrl: string;
};

// Reads config from the environment. Returns null when unconfigured so callers
// can treat "scanning off" as a first-class state rather than an error.
export function receiptScanConfig(): ReceiptScanConfig | null {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return null;
  return {
    apiKey,
    model: process.env.OPENROUTER_VISION_MODEL?.trim() || DEFAULT_MODEL,
    // Trim any trailing slash so we can append the path cleanly.
    baseUrl: (
      process.env.OPENROUTER_BASE_URL?.trim() || DEFAULT_BASE_URL
    ).replace(/\/+$/, ""),
  };
}

export function isReceiptScanConfigured(): boolean {
  return receiptScanConfig() !== null;
}

// A failure the user should see verbatim ("not configured", "couldn't read the
// receipt"), as opposed to an unexpected crash. The router maps this to a
// clean TRPCError instead of a generic 500.
export class ReceiptScanError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReceiptScanError";
  }
}

// What we hand back to the form. amount is in major units (e.g. 49.99) - the
// form's amount field is a major-unit string, so this maps straight in. Every
// field is nullable: the model leaves out anything the receipt doesn't show.
export type ReceiptScanResult = {
  description: string;
  amount: number | null;
  currency: string | null;
  vendor: string | null;
  category: string | null;
  // The invoice/receipt date as YYYY-MM-DD - the shape the form's date input
  // takes directly, kept as a string so no timezone math can shift the day.
  date: string | null;
  notes: string | null;
};

// Lenient parser for the model's JSON. In JSON-object mode the model can omit
// keys or hand back an amount as a string ("49.99"), so we accept loosely and
// normalize afterwards rather than reject a usable read on a formatting quirk.
const modelJsonSchema = z.object({
  description: z.string().nullish(),
  amount: z.union([z.number(), z.string()]).nullish(),
  currency: z.string().nullish(),
  vendor: z.string().nullish(),
  category: z.string().nullish(),
  date: z.string().nullish(),
  notes: z.string().nullish(),
});

// The model is asked to return exactly this JSON shape (the key list lives in
// the prompt rather than a strict schema so it works across vision models,
// including ones OpenRouter routes without json_schema support).
const SYSTEM_PROMPT = [
  "You extract structured expense data from a photo of a receipt or invoice.",
  "Respond with a single JSON object and nothing else, using exactly these keys:",
  '- "description": a short summary of what was bought, suitable as an expense line.',
  '- "amount": the grand total actually paid, including tax, as a number in major currency units (e.g. 49.99).',
  '- "currency": the three-letter ISO 4217 currency code (e.g. EUR, USD, GBP).',
  '- "vendor": the merchant or supplier name.',
  '- "category": a short spending category such as Software, Travel, Meals, Office, Hardware.',
  '- "date": the invoice or receipt date in ISO format (YYYY-MM-DD). Look for a',
  '  labelled "Invoice Date" or "Date"; otherwise use the document\'s own date.',
  '- "notes": any useful extra detail (invoice number, payment method), or null.',
  "Report amounts in the receipt's own currency. If a field is not clearly",
  "present, use null for it - never guess or invent values.",
].join("\n");

export type ScanDeps = {
  // Injected in tests; defaults to the global fetch in production.
  fetch?: typeof fetch;
  config?: ReceiptScanConfig;
};

// Trim a model string and collapse blanks to null, so the form never gets an
// empty string it has to special-case.
function cleanStr(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

// Coerce the model's amount (number or numeric string) into a positive number,
// or null. Strips currency symbols/thousands separators a string might carry.
function cleanAmount(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const num =
    typeof value === "number" ? value : Number(value.replace(/[^0-9.]/g, ""));
  return Number.isFinite(num) && num > 0 ? num : null;
}

// Only accept a real calendar date in YYYY-MM-DD form. Anything else (other
// formats, impossible dates like 2024-02-31) becomes null so the form keeps
// its existing date rather than getting a bad one.
function cleanDate(value: string | null | undefined): string | null {
  const trimmed = cleanStr(value);
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  // Date.parse rolls an out-of-range day into the next month, so round-trip
  // the components instead to reject e.g. 2024-02-31 outright.
  const [y, m, d] = trimmed.split("-").map(Number);
  const parsed = new Date(Date.UTC(y, m - 1, d));
  const valid =
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d;
  return valid ? trimmed : null;
}

function normalize(raw: z.infer<typeof modelJsonSchema>): ReceiptScanResult {
  const currency = cleanStr(raw.currency);
  return {
    description: cleanStr(raw.description) ?? "",
    amount: cleanAmount(raw.amount),
    // Only accept a clean 3-letter code; anything else becomes null so the
    // form keeps its existing currency.
    currency:
      currency && /^[A-Za-z]{3}$/.test(currency) ? currency.toUpperCase() : null,
    vendor: cleanStr(raw.vendor),
    category: cleanStr(raw.category),
    date: cleanDate(raw.date),
    notes: cleanStr(raw.notes),
  };
}

// Calls OpenRouter with the receipt image and returns the normalized fields.
// Throws ReceiptScanError for anything the user can act on (not configured,
// model error, unreadable response); lets genuine bugs surface as themselves.
export async function scanReceipt(
  input: { dataUrl: string; mimeType: ScannableMime },
  deps: ScanDeps = {},
): Promise<ReceiptScanResult> {
  const config = deps.config ?? receiptScanConfig();
  if (!config) {
    throw new ReceiptScanError("Receipt scanning is not configured");
  }
  const doFetch = deps.fetch ?? fetch;

  let response: Response;
  try {
    response = await doFetch(`${config.baseUrl}${CHAT_COMPLETIONS_PATH}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiKey}`,
        "HTTP-Referer": APP_URL,
        "X-OpenRouter-Title": APP_NAME,
      },
      body: JSON.stringify({
        model: config.model,
        // Low temperature: this is extraction, not creative writing.
        temperature: 0,
        response_format: { type: "json_object" },
        // Several vision models on OpenRouter (Qwen3.7 Flash included) reason by
        // default. Reading a receipt doesn't need it, and turning it off keeps
        // the scan fast and cheap. Ignored by models without reasoning.
        reasoning: { effort: "none" },
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Extract the expense fields from this receipt as JSON.",
              },
              {
                type: "image_url",
                image_url: { url: input.dataUrl },
              },
            ],
          },
        ],
      }),
    });
  } catch {
    throw new ReceiptScanError("Could not reach the receipt scanning service");
  }

  if (!response.ok) {
    throw new ReceiptScanError(
      `The receipt scanning service rejected the request (${response.status})`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ReceiptScanError("The receipt scanning service returned no data");
  }

  // OpenRouter can report an upstream provider failure in a 200 body rather
  // than an HTTP error, so check for that before looking for content.
  const completion = body as ChatCompletion;
  if (completion?.error) {
    const status = completion.error.code ?? response.status;
    throw new ReceiptScanError(
      `The receipt scanning service rejected the request (${status})`,
    );
  }

  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new ReceiptScanError("Could not read anything from that receipt");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new ReceiptScanError("Could not read anything from that receipt");
  }

  const result = modelJsonSchema.safeParse(parsed);
  if (!result.success) {
    throw new ReceiptScanError("Could not read anything from that receipt");
  }
  return normalize(result.data);
}

// Just the slice of the OpenRouter chat completion shape we read.
type ChatCompletion = {
  choices?: Array<{ message?: { content?: unknown } }>;
  error?: { code?: number | string; message?: string };
};
