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
- [ ] Add LICENSE file and licence metadata. [BLOCKED: ESC-1]
- [x] Wire Postgres + Drizzle: connection, initial schema for `business`,
      `user`, `client`, checked-in migrations, everything scoped by
      `business_id`.
- [x] Wire tRPC: base router, context, app integration, end-to-end typed.
      Note: context carries no session yet - the protected,
      `business_id`-scoped procedure helper lands with the agreed auth
      design (ESC-3).
- [x] One-command self-host: docker-compose (app + Postgres), `.env.example`,
      documented in README.
- [ ] Auth: self-hostable email/password sessions, no hosted-only provider.
      [BLOCKED: ESC-3]
- [ ] Seed script with demo business, clients, projects, tasks, time entries.
      Must always work (CLAUDE.md Section 10).
- [ ] CI: GitHub Actions workflow running the full gate on every push/PR.
- [ ] Honest README (what it is, what it is not yet, self-host instructions)
      and CONTRIBUTING (run locally, gate commands, commit convention,
      design-system rule).

## Phase 1 - projects and time

- [ ] Design tokens baseline in `/design` (provisional, pending human design
      pass). [BLOCKED: ESC-4]
- [ ] Clients module: list/create/edit/archive, company + contacts, activity
      history thread. Cross-business isolation test required.
- [ ] Projects module: projects linked to clients, statuses, due dates.
- [ ] Tasks: CRUD within a project, statuses, estimates, board view + list
      view.
- [ ] Time tracking: start/stop timer + manual entry against a task,
      billable flag and rate.
- [ ] Weekly timesheet view: entries by day/task, week navigation, totals.

## Phase 2 - billing (the provably-correct core)

All billing implementation is blocked until the billing spec exists.
[BLOCKED: ESC-2]

- [ ] Billing fixture harness: `fixtures/billing/` loader + `pnpm test:billing`
      running real fixtures. [BLOCKED: ESC-2]
- [ ] Currency handling: minor-unit arithmetic, conversion, per-currency
      rounding, fixture-covered. [BLOCKED: ESC-2]
- [ ] Tax/VAT engine per spec: standard, zero-rated, reverse-charge,
      mixed-rate invoices, fixture-covered. [BLOCKED: ESC-2]
- [ ] Sequential invoice numbering per business: no gaps, no duplicates,
      concurrency-safe, fixture-covered. [BLOCKED: ESC-2]
- [ ] Invoice-from-tracked-time: aggregate unbilled time into line items at
      the right rate, fixture-covered. [BLOCKED: ESC-2]
- [ ] Invoice lifecycle: draft/sent/paid/overdue, marking time entries as
      billed. [BLOCKED: ESC-2]
- [ ] Branded PDF export. [BLOCKED: ESC-2, ESC-4]

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
