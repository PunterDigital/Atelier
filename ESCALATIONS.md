# Escalations

Open questions for the human, per CLAUDE.md Section 7. Each entry has full
context and a recommended option. Resolve by answering inline and moving the
entry to the Resolved section; unblock the matching `[BLOCKED: ESC-n]` items
in `TASKS.md`.

## Open

### ESC-2: Billing spec - answered in principle, draft pending sign-off

**Blocks:** all Phase 2 implementation. Unblocks drafting `BILLING-SPEC.md`.

**Shay's answers (2026-06-10):**

1. Currencies: support all (raised as a question - the draft will propose
   all ISO 4217 currencies with correct minor units, flagged for sign-off).
2. FX: a no-account API if a wise one exists, otherwise Frankfurter.
   Conversion is fixed on the invoice date.
3. VAT at launch: standard rate, zero-rated, EU reverse charge. No
   mixed-rate invoices for now.
4. Numbering: `year-number` format.
5. Time-to-line: user-configurable grouping (e.g. one line per person/rate
   with a free-text work summary, as in "shay, day rate of 310 euros, did
   this throughout the week" followed by a list).

**Status (2026-06-10):** `BILLING-SPEC.md` is drafted - [agreed] items
encode the answers above, [proposed] items fill the gaps (minor-unit
integer math, half-up rounding at three defined points, Frankfurter with
manual-rate fallback, per-business-per-year numbering allocated at issue
time under a row lock, stored-rate precedence entry > project > client,
exact-seconds billing). Worked examples are hand-verified. Implementation
stays blocked until Shay ticks the sign-off box in the spec (or returns
corrections).

## Resolved

### ESC-1: Licence choice -> AGPL-3.0 (2026-06-10)

Shay confirmed AGPL-3.0, matching the plan's reasoning (prevents closed
hosted strip-mining; Plane and Worklenz precedent). Action: LICENSE file,
`license` field, README section.

### ESC-3: Auth design -> Better Auth, small teams + optional Google SSO (2026-06-10)

Small teams supported from day one. Third-party sign-on (e.g. Google) must
exist alongside email/password - kept optional via env config so
self-hosting never requires a Google account (the no-mandatory-third-party
constraint stands). Remaining detail (session strategy, library specifics)
delegated to the agent: Better Auth, server-side database sessions,
`business_id` scoping enforced in the tRPC context.

### ESC-4: Design baseline -> design file supplied (2026-06-10)

Shay supplied a design file to implement instead of the provisional stock
shadcn baseline:
`https://api.anthropic.com/v1/design/h/sQJmeJcjHhkn8Y40-0xELw`
(instruction: fetch it, read its readme, implement the relevant aspects).
Final aesthetic sign-off remains human per CLAUDE.md - screens built to
the new tokens still get a design review before they count as done.
