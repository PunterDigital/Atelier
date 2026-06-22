import "server-only";

export type CurrencyOption = { code: string; label: string };

// The full ISO 4217 list, built from the runtime's own currency registry so
// there is no hand-maintained list to drift. MUST be computed on the server
// (hence `server-only`) and passed to client components as a prop: the Node
// and browser ICU datasets disagree on some currency names (e.g. the SLL/SLE
// Sierra Leonean Leone), so computing this independently on each side produces
// a React hydration mismatch. Computing it once here and serialising it keeps
// server and client output identical.
export function listCurrencyOptions(): CurrencyOption[] {
  const names = new Intl.DisplayNames(["en"], { type: "currency" });
  return Intl.supportedValuesOf("currency").map((code) => ({
    code,
    label: `${code} - ${names.of(code) ?? code}`,
  }));
}
