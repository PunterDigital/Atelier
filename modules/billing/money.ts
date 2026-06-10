// Money core, part 2: exact arithmetic with half-up rounding at the three
// points the billing spec defines (Section 5):
//   1. each line total (qty x unit price)
//   2. the tax amount
//   3. a converted amount
// Everything is integer/bigint - floats never touch money. Sums of
// already-rounded values are never re-rounded.

import { minorUnitDigits } from "./currency";

// Half-up division for non-negative values: round(n/d) with 0.5 away
// from zero. The only rounding primitive in the codebase.
export function roundHalfUpDiv(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= 0n) {
    throw new Error("roundHalfUpDiv: denominator must be positive");
  }
  if (numerator < 0n) {
    throw new Error("roundHalfUpDiv: negative amounts are not in spec v1");
  }
  return (2n * numerator + denominator) / (2n * denominator);
}

// Rounding point 1 (time-based line): exact seconds at a per-hour rate in
// minor units. hours = seconds / 3600 in decimal, rounded once at the
// line total. Spec example: 70min at EUR 31.00/h -> 3617 (EUR 36.17).
export function lineTotalMinorFromSeconds(
  durationSeconds: number,
  rateMinorPerHour: number,
): number {
  return Number(
    roundHalfUpDiv(
      BigInt(durationSeconds) * BigInt(rateMinorPerHour),
      3600n,
    ),
  );
}

// Parses a non-negative decimal string ("1.1734", "21", "12.5") into an
// exact scaled integer. Rejects anything else - rates and percentages
// arrive as strings precisely so they are never floats.
export function parseDecimal(value: string): { mantissa: bigint; scale: number } {
  const match = /^(\d+)(?:\.(\d+))?$/.exec(value.trim());
  if (!match) {
    throw new Error(`Not a plain decimal: "${value}"`);
  }
  const [, whole, fraction = ""] = match;
  return {
    mantissa: BigInt(whole + fraction),
    scale: fraction.length,
  };
}

// Rounding point 2 (tax): tax on the subtotal at a percentage given as a
// decimal string. Spec example: 3333 at "21" -> 700 (EUR 7.00).
export function taxMinor(subtotalMinor: number, ratePercent: string): number {
  const rate = parseDecimal(ratePercent);
  return Number(
    roundHalfUpDiv(
      BigInt(subtotalMinor) * rate.mantissa,
      100n * 10n ** BigInt(rate.scale),
    ),
  );
}

// Rounding point 3 (conversion): amount in the source currency's minor
// units times a decimal rate string, rounded once to the target currency's
// minor unit. Handles differing minor-unit digits (e.g. EUR -> JPY).
// Spec example: 46500 GBP at "1.1734" -> 54563 (EUR 545.63).
export function convertMinor(
  amountMinor: number,
  rate: string,
  fromCurrency: string,
  toCurrency: string,
): number {
  const fromDigits = BigInt(minorUnitDigits(fromCurrency));
  const toDigits = BigInt(minorUnitDigits(toCurrency));
  const parsed = parseDecimal(rate);
  // amount/10^df * mantissa/10^scale * 10^dt, rounded half-up once.
  const numerator = BigInt(amountMinor) * parsed.mantissa * 10n ** toDigits;
  const denominator = 10n ** (fromDigits + BigInt(parsed.scale));
  return Number(roundHalfUpDiv(numerator, denominator));
}

// Sums already-rounded line totals. No rounding here by design.
export function subtotalMinor(lineTotals: number[]): number {
  return lineTotals.reduce((sum, value) => {
    if (!Number.isInteger(value) || value < 0) {
      throw new Error("subtotalMinor: line totals must be non-negative integers");
    }
    return sum + value;
  }, 0);
}
