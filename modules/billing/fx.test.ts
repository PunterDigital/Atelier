import { describe, expect, it } from "vitest";

import { fetchEcbRate } from "./fx";

// Response shapes below are verbatim from live Frankfurter v1 responses
// observed on 2026-06-11.
function stubFetch(status: number, body: string): typeof fetch {
  return async (input) => {
    stubFetch.lastUrl = String(input);
    return new Response(body, { status });
  };
}
stubFetch.lastUrl = "";

describe("fetchEcbRate", () => {
  it("requests the invoice date and extracts the rate without float round-trips", async () => {
    const result = await fetchEcbRate({
      date: new Date("2026-06-08T15:30:00Z"),
      from: "GBP",
      to: "EUR",
      fetchImpl: stubFetch(
        200,
        '{"amount":1.0,"base":"GBP","date":"2026-06-08","rates":{"EUR":1.1579}}',
      ),
    });
    expect(stubFetch.lastUrl).toBe(
      "https://api.frankfurter.dev/v1/2026-06-08?base=GBP&symbols=EUR",
    );
    expect(result).toEqual({
      rate: "1.1579",
      effectiveDate: "2026-06-08",
      source: "ecb",
    });
  });

  it("reports the previous business day Frankfurter uses for weekends", async () => {
    const result = await fetchEcbRate({
      date: new Date("2026-06-07T09:00:00Z"),
      from: "GBP",
      to: "EUR",
      fetchImpl: stubFetch(
        200,
        '{"amount":1.0,"base":"GBP","date":"2026-06-05","rates":{"EUR":1.157}}',
      ),
    });
    expect(result?.effectiveDate).toBe("2026-06-05");
    expect(result?.rate).toBe("1.157");
  });

  it("returns null for pairs Frankfurter does not cover (manual fallback)", async () => {
    const result = await fetchEcbRate({
      date: new Date("2026-06-08T00:00:00Z"),
      from: "GBP",
      to: "XXX",
      fetchImpl: stubFetch(404, '{"message":"not found"}'),
    });
    expect(result).toBeNull();
  });

  it("fails loud on server errors instead of inventing a rate", async () => {
    await expect(
      fetchEcbRate({
        date: new Date("2026-06-08T00:00:00Z"),
        from: "GBP",
        to: "EUR",
        fetchImpl: stubFetch(521, "error code: 521"),
      }),
    ).rejects.toThrow(/521/);
  });

  it("fails loud on unexpected response shapes", async () => {
    await expect(
      fetchEcbRate({
        date: new Date("2026-06-08T00:00:00Z"),
        from: "GBP",
        to: "EUR",
        fetchImpl: stubFetch(200, '{"unexpected":true}'),
      }),
    ).rejects.toThrow(/unexpected shape/);
  });
});
