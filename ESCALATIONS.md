# Escalations

Open questions for the human, per CLAUDE.md Section 7. Each entry has full
context and a recommended option. Resolve by answering inline and moving the
entry to the Resolved section; unblock the matching `[BLOCKED: ESC-n]` items
in `TASKS.md`.

## Open

(none)

## Resolved

### ESC-6: FX fixing moment for drafts -> at generation, never refreshed (2026-06-11)

Shay confirmed the implemented reading: the ECB/manual rate is fixed
when lines are generated, stored per line with its effective business
day, and never touched afterwards - including at issue. Re-pricing
means deleting lines and regenerating, an explicit visible act.

### ESC-5: Rate currency vs invoice currency -> Option 1, per-line conversion (2026-06-10)

Shay chose Option 1: entries whose stored rate currency differs from the
invoice currency are converted at the invoice-date rate, so one invoice
absorbs any entries. Encoded in spec Section 7 with the exact order of
operations (line total in rate currency first, converted once) and a
worked example. Unblocks invoice-from-time; fixtures land with it.

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
