# Atelier

An open-source, self-hostable business operating system for
developer-freelancers and small dev studios: clients, projects, time
tracking and invoicing in one connected flow.

## Status: pre-alpha, not usable yet

This is day-one scaffolding. There is no usable feature yet - no clients,
no projects, no time tracking, no invoicing. What exists today:

- Next.js (App Router, TypeScript strict) + Tailwind + shadcn/ui
- The Atelier design system tokens (light + dark, self-hosted fonts)
- Auth: email/password sign-up and sign-in (Better Auth), optional Google
  SSO via env, business creation on first run, small-team memberships
- tRPC API wiring with session-aware, business-scoped procedures
- Postgres + Drizzle with checked-in migrations
- One-command self-host via docker-compose

The README will track honest feature status as things actually land.

## Self-host (one command)

Requires Docker.

```bash
git clone https://github.com/PunterDigital/Atelier.git
cd Atelier
docker compose up
```

This starts Postgres, applies database migrations, and serves the app on
[http://localhost:3000](http://localhost:3000). Defaults are fine for
trying it locally; set `POSTGRES_PASSWORD` (see `.env.example`) before
exposing it anywhere.

## Local development

Requires Node 24+, pnpm 10+, and a Postgres instance (or use
`docker compose up postgres`).

```bash
pnpm install
cp .env.example .env   # point DATABASE_URL at your Postgres
pnpm db:migrate
pnpm db:seed           # optional demo data (demo@atelier.local / atelier-demo)
pnpm dev
```

Quality gate (all must pass before any commit):

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm test:billing
pnpm build
```

## Licence

[AGPL-3.0](LICENSE). You can self-host, modify, and redistribute freely;
if you run a modified version as a network service, you must offer its
source to your users. Chosen so the project stays genuinely open.
