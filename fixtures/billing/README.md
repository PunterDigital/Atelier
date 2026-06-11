# Billing fixtures

Ground truth for the billing module. Every fixture is an input with a
hand-verified expected output, and `pnpm test:billing` asserts the code
matches it exactly - not approximately.

## Status

No fixture cases exist yet. All money math (currency conversion, tax/VAT,
rounding, invoice numbering, time-to-line aggregation) is blocked on the
billing spec - see ESC-2 in `ESCALATIONS.md`. Fixtures land together with
the spec, never from memory or guesswork.

## Layout

- `cases/` - one JSON file per fixture. Required envelope: `description`
  (what real-world case this covers) and `expected` (the exact expected
  output). The full input shape per category is defined by the billing
  spec when it lands.
- `harness.test.ts` - loads and validates every case file. New fixture
  categories get their own test files alongside it.

## Rules

- Each fixture states the expected output exactly.
- Every new billing behaviour ships with new fixtures.
- A real-world case not covered by the spec gets escalated, not guessed.
- Never relax a fixture to make wrong math pass.
