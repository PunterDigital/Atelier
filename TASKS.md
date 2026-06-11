# Atelier backlog

Source of truth for the autonomous build loop (see CLAUDE.md Section 2).
One task at a time, top unchecked item first. Tasks marked `[BLOCKED: ESC-n]`
depend on an open escalation in `ESCALATIONS.md` and must be skipped until it
is resolved.

Derived from `atelier-software-plan.md` Section 12 (build phases). Update this
file in the same commit as the work it tracks.

## Phase 0 - skeleton

- [x] Scaffold the app: Next.js (App Router) + TypeScript strict + Tailwind +
      shadcn/ui, ESLint, Vitest, and the full gate wired as pnpm scripts
      (`typecheck`, `lint`, `test`, `test:billing` (empty suite to start),
      `build`). Repo layout per CLAUDE.md Section 11.
- [x] Add LICENSE file and licence metadata (AGPL-3.0, per resolved ESC-1).
- [x] Wire Postgres + Drizzle: connection, initial schema for `business`,
      `user`, `client`, checked-in migrations, everything scoped by
      `business_id`.
- [x] Wire tRPC: base router, context, app integration, end-to-end typed.
      Note: context carries no session yet - the protected,
      `business_id`-scoped procedure helper lands with the agreed auth
      design (ESC-3).
- [x] One-command self-host: docker-compose (app + Postgres), `.env.example`,
      documented in README.
- [x] Auth (per resolved ESC-3): Better Auth, email/password + optional
      Google SSO via env config, server-side DB sessions, small teams from
      day one, protected tRPC procedure deriving `business_id` from the
      session. Sign-in/sign-up/onboarding screens pending human design
      review (built from tokens, structure verified).
- [x] Seed script with demo business, clients, projects, tasks, time entries.
      Must always work (CLAUDE.md Section 10) - enforced by a CI job that
      migrates + seeds (twice, proving idempotency) on real Postgres.
- [x] CI: GitHub Actions workflow running the full gate on every push/PR.
- [x] Honest README (what it is, what it is not yet, self-host instructions)
      and CONTRIBUTING (run locally, gate commands, commit convention,
      design-system rule).

## Phase 1 - projects and time

- [x] Design tokens in `/design` from the design file Shay supplied
      (resolved ESC-4): fetch it, read its readme, implement the relevant
      aspects. Screens still get human design review before final.
- [x] Clients module, domain + API: schema (archive flag, activity table),
      module services, tRPC router behind `businessProcedure`, and a real
      cross-business isolation test against an actual Postgres (PGlite).
- [x] Clients UI: app shell (sidebar + topbar per design system), clients
      list, create/edit, archive, activity thread. Design review: APPROVED
      by Shay 2026-06-10; this screen pattern is the Phase 1 baseline.
- [x] Projects module: projects linked to clients, statuses, due dates.
- [x] Tasks: CRUD within a project, statuses, estimates, board view + list
      view.
- [x] Time tracking: start/stop timer + manual entry against a task,
      billable flag and rate.
- [x] Weekly timesheet view: entries by day/task, week navigation, totals.

## Phase 2 - billing (the provably-correct core)

- [x] Draft `BILLING-SPEC.md` from Shay's ESC-2 answers with worked
      examples; goes back to Shay for sign-off before any implementation.

Spec approved 2026-06-10 (`BILLING-SPEC.md`). Everything below is built
fixture-first against it; a case the spec misses gets escalated.

- [x] Money core: minor-unit integer arithmetic, ISO 4217 minor units,
      half-up rounding at the three spec-defined points, fixture-covered.
- [x] Currency conversion: Frankfurter rates fixed on invoice date, manual
      rate fallback, stored rate + source on the invoice, fixture-covered.
      (Conversion arithmetic fixture-covered in money core; ECB v1 client
      with float-free extraction; line storage fields exist and get wired
      by invoice-from-time.)
- [x] Tax/VAT engine per spec: standard rate from tax_config, zero-rated,
      EU reverse charge with mandatory notes, subtotal-based, one
      treatment per invoice, fixture-covered.
- [x] Invoice numbering: `YYYY-NNNN` per business per year, allocated at
      issue under a row lock, configurable next-number (spec Section 6
      feedback; settings UI lands with the invoices UI), concurrency
      proven by a parallel-issue check in the Postgres CI job.
- [x] Invoice-from-tracked-time: grouping modes (person+rate, per task,
      single line), stored-rate billing, exact-seconds durations,
      per-line FX per ESC-5, fixture-covered + PGlite integration
      (linking, release on line removal, totals through the tax engine).
- [x] Invoice lifecycle: draft/sent/paid/overdue, marking time entries as
      billed, removed lines return entries to the unbilled pool.
- [x] Invoices router + UI: list, draft editor with generate-from-time
      flow (incl. FX fetch/manual fallback), issue/mark-paid actions,
      numbering settings. PENDING HUMAN DESIGN REVIEW (new screen type) -
      behaviour browser-verified against hand-computed figures.
- [ ] Branded PDF export.

## Phase 3 - polish and launch (human-heavy)

- [ ] Importers: AndCo CSV first, then Invoice Ninja / FreshBooks.
- [ ] Public read-only demo instance.
- [ ] Full design pass (human-led; agent applies the resulting system).
- [ ] Launch docs and announcement material (human-led).

## Phase 4 - expand (not started)

- [ ] Proposals with itemised pricing, convert-to-project on acceptance.
- [ ] Recurring invoices + payment-status tracking (background jobs).
- [ ] Multiple businesses/entities under one instance.
- [ ] Expense capture and attach-to-project.
- [ ] Export-everything (anti-lock-in, testable).

## Shipped

- 2026-06-11 Dual-purpose invoices (Shay's review request): fixed-amount
  manual lines alongside generated time lines - exact minor-unit input
  (over-precise amounts rejected, never rounded), one totals pipeline
  through the tax engine, drafts only. ESC-6 confirmed and resolved.
  Browser-verified incl. mixed manual+converted totals; on
  `feat/manual-invoice-lines`.

- 2026-06-11 Invoices UI + settings: invoices list with lifecycle pills,
  new-draft form (standard treatment gated on a configured VAT rate),
  draft editor with generate-from-time (grouping modes, FX confirmation
  panel fetching live ECB rates with manual override, conversion noted
  per line), issue and mark-paid actions, line removal, and a settings
  page (business + VAT rate + numbering continuation). Whole flow
  browser-verified against hand-computed figures incl. a live ECB
  conversion and the 2026-0100 configured number. ESC-6 interpretation
  note logged (FX fixes at generation, never refreshed). Awaiting design
  review; on `feat/invoices-ui`.

- 2026-06-11 Invoice lifecycle: sent past-due flips to overdue on read
  (business-scoped, no stale statuses, no job needed yet), paid is a
  terminal SQL-guarded transition from sent/overdue only, drafts and
  foreign invoices can never be paid. PGlite-tested; on
  `feat/invoice-lifecycle`.

- 2026-06-11 Invoice-from-time: pure grouping core (person+rate / task /
  single, ESC-5 per-line conversion with originals recorded, unpriced
  entries surfaced, missing FX rates reported never guessed) with both
  spec worked examples passing verbatim as fixtures; transactional
  generation links entries to lines, recomputes totals through the tax
  engine, refuses non-drafts, and releases entries when a draft line is
  removed; on `feat/invoice-from-time`.

- 2026-06-11 FX client: Frankfurter v1 (the ECB-only endpoint - verified
  live that v2 blends other central banks and disagrees), rate extracted
  from raw text so the decimal never round-trips through a float,
  effective business day reported for weekend requests, null for
  uncovered pairs (manual fallback), fail-loud on errors and shape
  drift. Stub-tested against verbatim live response shapes; on
  `feat/billing-fx-client`.

- 2026-06-11 Invoice schema + numbering: invoice/invoice_line/
  invoice_sequence tables (drafts unnumbered, one treatment per invoice,
  ESC-5 conversion fields on lines, time entries link to lines and
  release on line removal), issue-time allocation under a row lock with
  yearly reset, configurable continuation point that refuses collisions
  with issued numbers. Fixture-covered on PGlite; 10-way parallel issue
  proof runs in the Postgres CI job; on `feat/invoice-numbering`.

- 2026-06-10 Tax engine: the three spec treatments with their mandatory
  notes verbatim, tax once on the subtotal, fail-loud when a standard
  rate is not configured (never defaulted). The spec's worked-example
  table is fixture-encoded row by row; on `feat/billing-tax`.

- 2026-06-10 Money core complete: bigint half-up rounding at exactly the
  three spec points (time-based line totals, subtotal tax, currency
  conversion incl. differing minor-unit digits), decimal-string parsing
  so floats never touch money, sum-without-re-rounding. Every worked
  example from the approved spec is a fixture and passes verbatim; on
  `feat/billing-money-core`.

- 2026-06-10 Seed: pnpm db:seed builds a demo business (clients, projects,
  kanban tasks, a believable current week of time entries) through the
  real module services and real Better Auth sign-up; idempotent; demo
  credentials documented in README; guarded by its own CI job. Phase 0 is
  now fully complete. Verified locally end to end (demo login sees only
  demo data); on `feat/seed`.

- 2026-06-10 Weekly timesheet: /time with Monday-start UTC weeks (tested
  week math), per-day sections with task/project/client context, day and
  week totals, prev/this/next navigation, honest empty state. Phase 1
  feature set complete pending the seed script. Browser-verified; on
  `feat/timesheet`.

- 2026-06-10 Time tracking: time_entry schema (exact seconds, stored
  rate + currency per the spec's precedence, proven by tests), default
  rate fields on clients/projects with form UI, timer start/stop with
  switch-stops-previous semantics, ticking topbar chip, per-card timer
  buttons, manual logging + entry list in the task dialog. First real
  billing fixtures landed (ISO 4217 minor units in modules/billing).
  ESC-5 raised: rate currency vs invoice currency needs a spec call
  before invoice-from-time. Browser-verified (and the verification
  caught a native step-validation bug in the hours input); on
  `feat/time-tracking`.

- 2026-06-10 Tasks: task schema (todo/in_progress/in_review/done, estimate
  in minutes), scoped services with PGlite isolation suite, tasks router,
  kanban board (drag-to-move, per-column quick add) + list toggle on the
  project page, edit dialog with delete. Verified in the browser; on
  `feat/tasks`.

- 2026-06-10 Projects module: schema + migration, scoped services with
  PGlite isolation suite (including the cross-entity proof that a project
  cannot link or move to a foreign client), projects router, list/new/
  detail/edit screens on the approved pattern, project_created on the
  client activity thread, projects card on client detail. Verified in the
  browser; on `feat/projects`.

- 2026-06-10 Clients UI: app shell (244px sidebar + translucent topbar per
  the design system, compact topbar nav below md), clients list with
  empty state and archived view, create/edit forms with contacts editor,
  detail page with activity thread, note composer, archive/restore. Flow
  verified end-to-end in the browser against local Postgres; activity got
  a monotonic seq column after a timestamp-collision flake. Awaiting
  human design review; on `feat/clients-ui`.

- 2026-06-10 Clients domain + API: archive flag + activity table migration,
  modules/clients services (list/get/create/update/archive/notes, every
  query business-scoped), clients tRPC router, and the PGlite integration
  suite proving cross-business access is denied at the data layer; on
  `feat/clients-domain`.

- 2026-06-10 Auth: Better Auth (email/password + env-gated Google SSO, DB
  sessions), business_member join replaces user.business_id for small
  teams, authedProcedure/businessProcedure tenancy ladder, sign-in/up +
  onboarding screens, clean initial migration. Verified end-to-end on a
  local stack: sign-up, session, onboarding redirect, business creation,
  scoped query, 401 without session; on `feat/auth`.

- 2026-06-10 Design tokens: implemented the Atelier Design System bundle
  (Claude Design) with Soft Teal locked as primary (Shay's pick); full
  color/type/spacing/elevation token set in `/design/tokens`, mapped to
  the shadcn theme in globals.css, Figtree + JetBrains Mono self-hosted
  via next/font, brand SVGs in `public/brand`; on `feat/design-tokens`.

- 2026-06-10 Licence: canonical AGPL-3.0 text as LICENSE, SPDX field in
  package.json, README licence section; on `chore/license`.

- 2026-06-10 Docs: honest pre-alpha README (landed with the self-host task)
  and CONTRIBUTING covering setup, the gate, conventions, the design-system
  rule, and the billing fixture rule; on `docs/contributing`.

- 2026-06-10 CI: GitHub Actions gate (typecheck/lint/test/test:billing/build)
  verified green on the actual runner; on `chore/ci-gate`.

- 2026-06-10 Self-host: multi-stage Dockerfile (standalone output), compose
  stack postgres -> one-shot migrate -> app with overridable env defaults,
  honest pre-alpha README with quickstart. Verified end-to-end on a Linux
  Docker engine: migrations applied, health.ping answered ok; on
  `feat/docker-selfhost`.

- 2026-06-10 tRPC wiring: init/context (no session yet, per ESC-3), health
  router with caller-level test, fetch adapter route, RSC caller, React
  Query provider in the root layout; on `feat/trpc-wiring`.

- 2026-06-10 Drizzle + Postgres: `business`/`user`/`client` schema per the
  plan sketch, checked-in initial migration, lazy DB client (no env needed
  at build time), structural test enforcing `business_id` on every domain
  table; on `feat/db-drizzle`.

- 2026-06-10 Scaffold: Next.js 16 (App Router, TS strict) + Tailwind 4 +
  shadcn/ui (radix-nova, neutral, provisional per ESC-4) + Vitest; full gate
  (`typecheck`/`lint`/`test`/`test:billing`/`build`) wired and green on
  `feat/scaffold-app`.
