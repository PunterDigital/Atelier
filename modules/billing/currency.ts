// Money core, part 1: ISO 4217 minor units (billing spec Section 2).
// All amounts in Atelier are integers in the currency's minor unit; these
// helpers convert at the display/input edge. No floats: major-unit values
// travel as strings and are parsed digit-wise.
//
// ISO 4217 defines 2 minor-unit digits for most currencies; the
// exceptions below are the full ISO lists for 0 and 3 digits (plus 4 for
// the two funds codes). Source: ISO 4217:2015 amendment list.

const ZERO_DECIMAL = new Set([
  "BIF", "CLP", "DJF", "GNF", "ISK", "JPY", "KMF", "KRW", "PYG", "RWF",
  "UGX", "UYI", "VND", "VUV", "XAF", "XOF", "XPF",
]);

const THREE_DECIMAL = new Set(["BHD", "IQD", "JOD", "KWD", "LYD", "OMR", "TND"]);

const FOUR_DECIMAL = new Set(["CLF", "UYW"]);

export function minorUnitDigits(currency: string): number {
  const code = currency.toUpperCase();
  if (ZERO_DECIMAL.has(code)) {
    return 0;
  }
  if (THREE_DECIMAL.has(code)) {
    return 3;
  }
  if (FOUR_DECIMAL.has(code)) {
    return 4;
  }
  return 2;
}

// Parses a human-entered major-unit amount ("62", "62.5", "62.50") into
// minor units exactly. Returns null for anything that does not parse or
// has more decimal places than the currency allows - never rounds input.
export function majorToMinor(major: string, currency: string): number | null {
  const digits = minorUnitDigits(currency);
  const match = /^(\d+)(?:\.(\d+))?$/.exec(major.trim());
  if (!match) {
    return null;
  }
  const [, whole, fraction = ""] = match;
  if (fraction.length > digits) {
    return null;
  }
  const padded = fraction.padEnd(digits, "0");
  return Number(whole) * 10 ** digits + (padded ? Number(padded) : 0);
}

// Formats minor units back to a major-unit string ("6250" GBP -> "62.50").
export function minorToMajor(minor: number, currency: string): string {
  const digits = minorUnitDigits(currency);
  if (digits === 0) {
    return String(minor);
  }
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 10 ** digits);
  const fraction = String(abs % 10 ** digits).padStart(digits, "0");
  return `${sign}${whole}.${fraction}`;
}
