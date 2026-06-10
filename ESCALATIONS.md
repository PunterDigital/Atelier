# Escalations

Open questions for the human, per CLAUDE.md Section 7. Each entry has full
context and a recommended option. Resolve by answering inline and moving the
entry to the Resolved section; unblock the matching `[BLOCKED: ESC-n]` items
in `TASKS.md`.

## Open

### ESC-5: Rate currency vs invoice currency at invoice-from-time

**Blocks:** the Phase 2 invoice-from-time task only. Time tracking itself
is unaffected (it stores rate + currency verbatim).

**Context:** The billing spec fixes rate precedence (entry > project >
client, stored at entry creation) and fixes FX conversion on the invoice
date, but does not say what happens when stored entry rates are
denominated in a currency different from the invoice currency - e.g.
entries at EUR 62.00/h pulled into a GBP invoice. Mixed-rate-currency
entry sets are also possible (project rate EUR, manual entry GBP).

**Options:**
1. Convert each entry's rate into the invoice currency at the invoice-date
   rate (spec Section 3 mechanics), so one invoice can absorb any entries.
2. Require all selected entries to share the invoice currency and make
   mismatches a validation error the user resolves by editing rates.
3. Group strictly by rate currency: the generate flow only offers entries
   whose rate currency matches the invoice currency.

**Recommendation:** Option 1, because it preserves "invoice in any
currency" with the already-agreed conversion mechanics, with the
conversion noted per line. But this is money behaviour - it needs your
call and a spec amendment (Section 7) plus fixtures before
implementation.

## Resolved

### ESC-2: Billing spec -> BILLING-SPEC.md approved (2026-06-10)

Shay answered the five spec questions, reviewed the drafted
`BILLING-SPEC.md`, ticked the sign-off box, and added one requirement
during review: the current year's invoice sequence position is
configurable in settings so a migrating business can continue its
existing numbering. Folded into spec Section 6. Phase 2 implementation
is unblocked, fixture-first.

### ESC-4 follow-up: clients UI design review -> approved (2026-06-10)

Shay reviewed the running app (shell, clients screens, auth screens)
and approved the design system implementation. The established screen
pattern is the baseline for Phase 1 modules; new novel screen types
still get review.

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
