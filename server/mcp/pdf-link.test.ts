import { describe, expect, it } from "vitest";

import { signInvoicePdfToken, verifyInvoicePdfToken } from "./pdf-link";

const secret = "test-secret-do-not-use-in-prod";
const invoiceId = "11111111-1111-1111-1111-111111111111";
const businessId = "22222222-2222-2222-2222-222222222222";
// Fixed clock so tokens are deterministic across the suite.
const t0 = Date.UTC(2026, 5, 12, 12, 0, 0);

describe("invoice PDF link tokens", () => {
  it("round-trips a valid token back to its payload", () => {
    const token = signInvoicePdfToken(
      { invoiceId, businessId },
      { secret, nowMs: t0 },
    );
    const payload = verifyInvoicePdfToken(token, { secret, nowMs: t0 });
    expect(payload).toMatchObject({ invoiceId, businessId });
    expect(payload?.exp).toBe(Math.floor(t0 / 1000) + 15 * 60);
  });

  it("rejects a tampered payload", () => {
    const token = signInvoicePdfToken(
      { invoiceId, businessId },
      { secret, nowMs: t0 },
    );
    // Flip the payload to a different business while keeping the signature.
    const [, sig] = token.split(".");
    const forgedPayload = Buffer.from(
      JSON.stringify({
        invoiceId,
        businessId: "99999999-9999-9999-9999-999999999999",
        exp: Math.floor(t0 / 1000) + 600,
      }),
    ).toString("base64url");
    expect(
      verifyInvoicePdfToken(`${forgedPayload}.${sig}`, { secret, nowMs: t0 }),
    ).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = signInvoicePdfToken(
      { invoiceId, businessId },
      { secret: "other-secret", nowMs: t0 },
    );
    expect(verifyInvoicePdfToken(token, { secret, nowMs: t0 })).toBeNull();
  });

  it("rejects an expired token", () => {
    const token = signInvoicePdfToken(
      { invoiceId, businessId },
      { secret, nowMs: t0, ttlSeconds: 60 },
    );
    const later = t0 + 61_000;
    expect(verifyInvoicePdfToken(token, { secret, nowMs: later })).toBeNull();
  });

  it("accepts a token one second before expiry and rejects at expiry", () => {
    const token = signInvoicePdfToken(
      { invoiceId, businessId },
      { secret, nowMs: t0, ttlSeconds: 60 },
    );
    expect(
      verifyInvoicePdfToken(token, { secret, nowMs: t0 + 59_000 }),
    ).not.toBeNull();
    expect(
      verifyInvoicePdfToken(token, { secret, nowMs: t0 + 60_000 }),
    ).toBeNull();
  });

  it("rejects malformed tokens", () => {
    for (const bad of ["", "nodot", "a.", ".b", "...", "a.b.c"]) {
      expect(verifyInvoicePdfToken(bad, { secret, nowMs: t0 })).toBeNull();
    }
  });
});
