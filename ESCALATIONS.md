# Escalations

Open questions for the human, per CLAUDE.md Section 7. Each entry has full
context and a recommended option. Resolve by answering inline and moving the
entry to the Resolved section; unblock the matching `[BLOCKED: ESC-n]` items
in `TASKS.md`.

## Open

### ESC-1: Licence choice (AGPL-3.0 vs MIT)

**Blocks:** LICENSE file, `license` field in package.json, README badge,
and any dependency-licence compatibility calls.

**Context:** The plan (Section 9) leans AGPL-3.0 to stop a closed hosted
clone strip-mining the project (Plane and Worklenz made the same call), with
MIT as the alternative if maximum adoption matters more. The plan explicitly
says decide deliberately because it is hard to change later, and CLAUDE.md
lists licensing as escalate-only.

**Recommendation:** AGPL-3.0, per the plan's own reasoning and the open-core
future it sketches. All current stack choices (Next.js, tRPC, Drizzle,
Tailwind, shadcn/ui - all MIT/Apache-2.0) are compatible with either choice,
so scaffolding proceeds while this is open.

### ESC-2: Billing spec does not exist yet

**Blocks:** all of Phase 2 (currency, VAT, rounding, numbering,
invoice-from-time, fixtures).

**Context:** CLAUDE.md forbids implementing any money math not covered by an
agreed billing spec, and requires the spec before starting any money-related
task (Section 12.4). No spec document exists in the repo. The plan names the
real-world cases the target user hits: multi-currency (CZK/GBP/EUR at
minimum), UK/CZ cross-border VAT including reverse charge, per-currency
rounding, sequential numbering per business.

**Recommendation:** Human writes (or dictates and I draft for sign-off) a
`BILLING-SPEC.md` covering, at minimum:

1. Supported currencies and the rounding rule per currency minor unit
   (e.g. round half-up to 2 dp for GBP/EUR, 0 dp handling if any).
2. Where FX rates come from and at what moment a conversion is fixed
   (invoice date? entry date? manual rate on the invoice?).
3. VAT rules to support at launch: standard rate per business jurisdiction,
   zero-rated, EU reverse charge (the cross-border case), and how mixed-rate
   invoices total (per-line tax then sum, or tax on subtotal).
4. Invoice number format and sequence scope (per business? per business per
   year? e.g. `2026-0001`), and the gap/duplicate guarantee under
   concurrency.
5. Time-to-line aggregation: grouping (per task? per day? per project?),
   rate precedence (entry rate vs task vs project vs client default), and
   duration rounding (e.g. nearest minute? 6-minute increments? none).

I can draft this document with worked examples for sign-off if that is
easier - say the word. I will not implement from my own draft without
explicit approval.

### ESC-3: Auth design sign-off

**Blocks:** auth task in Phase 0, and everything user-facing that needs a
session (most of Phase 1 UI in its final form).

**Context:** CLAUDE.md: implement an agreed security model, never invent
one. Constraints already agreed: self-hostable, no mandatory third-party
provider. The plan suggests Auth.js or Lucia; note Lucia was deprecated by
its author (it is now a learning resource, not a maintained library), so the
plan's options need a refresh.

**Recommendation:** email/password credentials with server-side database
sessions (httpOnly cookie), single-tenant instance, users belong to one or
more businesses with `business_id` scoping enforced in the tRPC context.
Library choice: Better Auth (MIT, self-hostable, maintained, Drizzle
adapter) over Auth.js, whose credentials-flow support is second-class. I
will verify current APIs against docs before implementing either way.
Needs your sign-off on: library, session strategy, and whether v1 is
single-user or small-team (the plan says "one user or a small team").

### ESC-4: Design tokens baseline (provisional taste call)

**Blocks:** `/design` tokens task; soft-blocks the visual layer of Phase 1
screens (structure/behaviour can proceed, final look cannot be called done).

**Context:** CLAUDE.md: I implement the design system, I do not invent
taste - and no design system exists yet. "Actually good-looking" is the
project's entire differentiator, so the baseline matters.

**Recommendation:** I set up shadcn/ui with its stock neutral theme as an
explicitly provisional baseline (tokens in `/design`, dark + light), build
Phase 0/1 screens against it, and every screen carries a "pending design
pass" status in TASKS.md until you do the human design pass (plan
Section 12, Phase 3). That keeps the loop unblocked without me shipping
taste as final. Confirm or supply a starting palette/type scale and I will
encode it as tokens instead.

## Resolved

(nothing yet)
