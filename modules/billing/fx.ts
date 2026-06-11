// FX rate source (billing spec Section 3): Frankfurter's v1 API, which
// serves exactly the ECB reference rates the spec names (the v2 API
// blends many central banks - verified live, different numbers). Rates
// are fixed on the invoice date and stored on the invoice; this client is
// only ever called at generation/issue time, never to refresh.
//
// The rate is extracted from the raw response text, not from parsed
// JSON, so the decimal literal never round-trips through a float.

export type EcbRate = {
  rate: string;
  // The business day the rate belongs to - for weekend/holiday requests
  // Frankfurter returns the previous business day and reports it here.
  effectiveDate: string;
  source: "ecb";
};

export async function fetchEcbRate(opts: {
  date: Date;
  from: string;
  to: string;
  fetchImpl?: typeof fetch;
}): Promise<EcbRate | null> {
  const { date, from, to, fetchImpl = fetch } = opts;
  const day = date.toISOString().slice(0, 10);
  const url = `https://api.frankfurter.dev/v1/${day}?base=${encodeURIComponent(
    from.toUpperCase(),
  )}&symbols=${encodeURIComponent(to.toUpperCase())}`;

  const response = await fetchImpl(url);
  if (response.status === 404) {
    // Frankfurter does not cover this pair - the caller falls back to a
    // manual rate (spec Section 3).
    return null;
  }
  if (!response.ok) {
    // Fail loud: a flaky rate source must never silently produce an
    // unpriced or mispriced invoice.
    throw new Error(`Frankfurter responded ${response.status} for ${day} ${from}->${to}`);
  }

  const body = await response.text();
  const rateMatch = new RegExp(
    `"${to.toUpperCase()}"\\s*:\\s*(\\d+(?:\\.\\d+)?)`,
  ).exec(body);
  const dateMatch = /"date"\s*:\s*"(\d{4}-\d{2}-\d{2})"/.exec(body);
  if (!rateMatch || !dateMatch) {
    throw new Error(`Frankfurter response for ${day} ${from}->${to} had an unexpected shape`);
  }
  return { rate: rateMatch[1], effectiveDate: dateMatch[1], source: "ecb" };
}
