import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// Harness mechanics only. Money-math fixtures are blocked on the billing
// spec (ESC-2 in ESCALATIONS.md) and land together with it.
const casesDir = fileURLToPath(new URL("./cases", import.meta.url));

describe("billing fixture harness", () => {
  it("can enumerate the fixture cases directory", () => {
    expect(existsSync(casesDir)).toBe(true);
  });

  it("accepts only valid JSON fixtures with a description and an exact expected output", () => {
    const files = readdirSync(casesDir).filter((f) => f.endsWith(".json"));
    for (const file of files) {
      const raw = readFileSync(path.join(casesDir, file), "utf8");
      const fixture: unknown = JSON.parse(raw);
      expect(fixture, `${file} must be a JSON object`).toBeTypeOf("object");
      const envelope = fixture as Record<string, unknown>;
      expect(envelope.description, `${file} is missing "description"`).toBeTypeOf("string");
      expect(envelope.expected, `${file} is missing "expected"`).toBeDefined();
    }
  });
});
