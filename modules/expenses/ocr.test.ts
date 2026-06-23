import { describe, expect, it, vi } from "vitest";

import {
  ReceiptScanError,
  receiptScanConfig,
  scanReceipt,
  type ReceiptScanConfig,
} from "./ocr";

const CONFIG: ReceiptScanConfig = {
  apiKey: "test-key",
  model: "vision-test",
  baseUrl: "https://api.groq.com/openai",
};

const IMAGE = {
  dataUrl:
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/1aHAAAAAElFTkSuQmCC",
  mimeType: "image/png" as const,
};

// Builds a fake Groq chat-completion response whose assistant message content
// is the given JSON string (or arbitrary content for the malformed cases).
function completionWith(content: unknown): Response {
  return new Response(
    JSON.stringify({ choices: [{ message: { content } }] }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

describe("scanReceipt", () => {
  it("returns normalized fields from a well-formed model response", async () => {
    const fetchMock = vi.fn(async () =>
      completionWith(
        JSON.stringify({
          description: "  Adobe Creative Cloud  ",
          amount: 49.99,
          currency: "eur",
          vendor: " Adobe ",
          category: "Software",
          notes: null,
        }),
      ),
    );

    const result = await scanReceipt(IMAGE, {
      fetch: fetchMock as unknown as typeof fetch,
      config: CONFIG,
    });

    expect(result).toEqual({
      description: "Adobe Creative Cloud",
      amount: 49.99,
      currency: "EUR",
      vendor: "Adobe",
      category: "Software",
      notes: null,
    });
  });

  it("coerces a string amount with a currency symbol to a number", async () => {
    const fetchMock = vi.fn(async () =>
      completionWith(
        JSON.stringify({
          description: "Lunch",
          amount: "€12.50",
          currency: "EUR",
          vendor: "Cafe",
          category: "Meals",
          notes: null,
        }),
      ),
    );

    const result = await scanReceipt(IMAGE, {
      fetch: fetchMock as unknown as typeof fetch,
      config: CONFIG,
    });

    expect(result.amount).toBe(12.5);
  });

  it("tolerates a partial response, defaulting missing keys", async () => {
    const fetchMock = vi.fn(async () =>
      completionWith(JSON.stringify({ description: "Taxi", amount: 20 })),
    );

    const result = await scanReceipt(IMAGE, {
      fetch: fetchMock as unknown as typeof fetch,
      config: CONFIG,
    });

    expect(result).toEqual({
      description: "Taxi",
      amount: 20,
      currency: null,
      vendor: null,
      category: null,
      notes: null,
    });
  });

  it("sends the image to Groq in JSON mode with auth", async () => {
    const fetchMock = vi.fn(async () =>
      completionWith(JSON.stringify({ description: "x" })),
    );

    await scanReceipt(IMAGE, {
      fetch: fetchMock as unknown as typeof fetch,
      config: CONFIG,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-key",
    );
    const payload = JSON.parse(init.body as string);
    expect(payload.model).toBe("vision-test");
    expect(payload.response_format).toEqual({ type: "json_object" });
    // The receipt image is included as an image_url content part.
    const parts = payload.messages.at(-1).content;
    expect(parts).toContainEqual({
      type: "image_url",
      image_url: { url: IMAGE.dataUrl },
    });
  });

  it("respects a custom base URL (proxy/gateway)", async () => {
    const fetchMock = vi.fn(async () =>
      completionWith(JSON.stringify({ description: "x" })),
    );

    await scanReceipt(IMAGE, {
      fetch: fetchMock as unknown as typeof fetch,
      config: { ...CONFIG, baseUrl: "http://localhost:9099/openai" },
    });

    const [url] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:9099/openai/v1/chat/completions");
  });

  it("drops a non-positive amount and an invalid currency to null", async () => {
    const fetchMock = vi.fn(async () =>
      completionWith(
        JSON.stringify({
          description: "Mystery",
          amount: 0,
          currency: "EUROS",
          vendor: "",
          category: "  ",
          notes: "ref 123",
        }),
      ),
    );

    const result = await scanReceipt(IMAGE, {
      fetch: fetchMock as unknown as typeof fetch,
      config: CONFIG,
    });

    expect(result.amount).toBeNull();
    expect(result.currency).toBeNull();
    expect(result.vendor).toBeNull();
    expect(result.category).toBeNull();
    expect(result.notes).toBe("ref 123");
  });

  it("throws ReceiptScanError when not configured", async () => {
    const fetchMock = vi.fn();
    await expect(
      scanReceipt(IMAGE, {
        fetch: fetchMock as unknown as typeof fetch,
        config: undefined,
      }),
    ).rejects.toThrow(ReceiptScanError);
    // Never reaches the network without a key.
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws ReceiptScanError on a non-OK response", async () => {
    const fetchMock = vi.fn(async () => new Response("nope", { status: 429 }));
    await expect(
      scanReceipt(IMAGE, {
        fetch: fetchMock as unknown as typeof fetch,
        config: CONFIG,
      }),
    ).rejects.toThrow(/429/);
  });

  it("throws ReceiptScanError when the model returns malformed JSON", async () => {
    const fetchMock = vi.fn(async () => completionWith("not json at all"));
    await expect(
      scanReceipt(IMAGE, {
        fetch: fetchMock as unknown as typeof fetch,
        config: CONFIG,
      }),
    ).rejects.toThrow(ReceiptScanError);
  });

  it("surfaces a network failure as ReceiptScanError", async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    });
    await expect(
      scanReceipt(IMAGE, {
        fetch: fetchMock as unknown as typeof fetch,
        config: CONFIG,
      }),
    ).rejects.toThrow(ReceiptScanError);
  });
});

describe("receiptScanConfig", () => {
  const KEY = "GROQ_API_KEY";
  const MODEL = "GROQ_VISION_MODEL";
  const BASE = "GROQ_BASE_URL";

  function withEnv(
    values: Record<string, string | undefined>,
    run: () => void,
  ) {
    const keys = [KEY, MODEL, BASE];
    const prev = Object.fromEntries(keys.map((k) => [k, process.env[k]]));
    try {
      for (const k of keys) {
        if (values[k] === undefined) delete process.env[k];
        else process.env[k] = values[k];
      }
      run();
    } finally {
      for (const k of keys) {
        if (prev[k] === undefined) delete process.env[k];
        else process.env[k] = prev[k];
      }
    }
  }

  it("returns null when no API key is set", () => {
    withEnv({ [KEY]: undefined }, () => {
      expect(receiptScanConfig()).toBeNull();
    });
  });

  it("reads the key and falls back to defaults", () => {
    withEnv({ [KEY]: "abc", [MODEL]: undefined, [BASE]: undefined }, () => {
      expect(receiptScanConfig()).toEqual({
        apiKey: "abc",
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        baseUrl: "https://api.groq.com/openai",
      });
    });
  });

  it("honors overridden model and base URL, trimming a trailing slash", () => {
    withEnv(
      { [KEY]: "abc", [MODEL]: "custom-vision", [BASE]: "http://proxy/api/" },
      () => {
        expect(receiptScanConfig()).toEqual({
          apiKey: "abc",
          model: "custom-vision",
          baseUrl: "http://proxy/api",
        });
      },
    );
  });
});
