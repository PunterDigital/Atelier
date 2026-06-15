# Contributing to Clerq

Thanks for considering it. The project is pre-alpha, so the most useful
contributions right now are small, focused, and discussed first in an
issue.

## Running locally

Requires Node 24+, pnpm 10+, and Postgres (or Docker).

```bash
pnpm install
cp .env.example .env        # point DATABASE_URL at your Postgres
pnpm db:migrate
pnpm dev
```

Or bring up the whole stack with `docker compose up`.

## The quality gate

Every change must pass the full gate, in this order, before it is
committed:

```bash
pnpm typecheck      # tsc --noEmit, zero errors
pnpm lint           # eslint, zero errors
pnpm test           # unit + integration
pnpm test:billing   # the money-math fixture suite
pnpm build          # production build
```

CI runs exactly this on every push and PR. Do not delete, skip, or
weaken a failing test to get green - fix the cause. If a test itself is
wrong, fix the test and explain why in the commit body.

## Conventions

- TypeScript strict everywhere. No `any` without a written justification.
- Conventional commit subjects (`feat:`, `fix:`, `test:`, `refactor:`,
  `chore:`, `docs:`), imperative, under ~70 characters, one logical
  change per commit.
- Branch per change: `feat/<slug>`, `fix/<slug>`, `chore/<slug>`.
  Nothing is committed directly to `main`.
- Single hyphens, never em dashes, in commits, comments, and docs.
- No secrets, `.env` files, or real client data in the repo, ever.

## The design-system rule

"Actually good-looking" is this project's entire reason to exist, so
visual consistency is enforced: UI is built from the design tokens and
shadcn/ui components (see `/design`), not ad-hoc styles. Structure and
behaviour are reviewed like any code; new screen layouts and novel
components additionally get a human design review before merging.

## The billing rule

The billing module (`/modules/billing`) is held to a higher bar: every
behaviour is covered by a fixture in `/fixtures/billing` with a
hand-verified expected output, written test-first. A billing PR without
fixtures will not be merged. If the billing spec does not cover your
case, open an issue - do not infer tax or rounding behaviour.

## Where things live

| Path                | What it is                                  |
| ------------------- | ------------------------------------------- |
| `/app`              | Next.js app (UI, routes)                    |
| `/server`           | tRPC routers, services                      |
| `/modules`          | domain modules (clients, projects, time, billing, proposals) |
| `/db`               | Drizzle schema + migrations                 |
| `/design`           | tokens, theme, shared UI primitives         |
| `/fixtures/billing` | money-math ground truth                     |
| `/jobs`             | background workers (later phase)            |

Module boundaries are deliberate: modules do not import each other's
internals. If your change needs a new cross-module surface, raise it in
the issue first.
