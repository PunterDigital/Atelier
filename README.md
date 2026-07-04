# Clerq

An open-source, self-hostable business operating system for
developer-freelancers and small dev studios: clients, projects, time
tracking, expenses and invoicing in one connected flow.

- **Website:** [useclerq.net](https://useclerq.net)
- **Documentation:** [useclerq.net/docs](https://useclerq.net/docs)

## Features

- **Clients** with contacts, default rates, VAT numbers and an activity thread
- **Projects and tasks** with a kanban board and list views
- **Time tracking:** start/stop timers, manual entries, and a weekly timesheet
- **Invoicing:** generate lines from unbilled time (grouped your way) or add
  fixed amounts; multi-currency with ECB conversion fixed per line;
  standard / zero-rated / reverse-charge VAT; gapless per-year numbering;
  draft / sent / paid / overdue lifecycle; branded PDF export
- **Expenses:** capture expenses and attach them to projects
- **Provably-correct money math:** every billing rule is fixture-tested with
  hand-verified expected output, using minor-unit integer arithmetic so floats
  never touch money
- **Teams and roles:** small-team memberships with roles and permissions,
  everything scoped per business
- **Multiple businesses per account:** one login can own and belong to several
  businesses, with a topbar switcher to move between them - clean separation,
  no second account needed
- **CSV import** with interactive column mapping for migrating clients in
- **Auth:** email/password (Better Auth), optional Google SSO via env config,
  server-side database sessions
- **One-command self-host** via docker-compose, demo seed included

## Self-host (one command)

Requires Docker.

```bash
git clone https://github.com/PunterDigital/clerq.git
cd clerq
docker compose up
```

This starts Postgres, applies database migrations, and serves the app on
[http://localhost:3000](http://localhost:3000). Defaults are fine for
trying it locally; set `POSTGRES_PASSWORD` (see `.env.example`) before
exposing it anywhere.

### Make yourself a platform admin

The System Administration area (cross-tenant stats and moderation) requires an
existing platform admin, which the first sign-up cannot be. Create your account
in the app, then bootstrap yourself from the running container:

```bash
docker compose exec app node grant-admin.mjs you@example.com
```

It's idempotent, so re-running is harmless. Once you're in, grant any other
admins from System Administration → Users. (Contributors running from a source
checkout can use `pnpm admin:grant <email>` instead.)

## Local development

Requires Node 24+, pnpm 10+, and a Postgres instance (or use
`docker compose up postgres`).

```bash
pnpm install
cp .env.example .env   # point DATABASE_URL at your Postgres
pnpm db:migrate
pnpm db:seed           # optional demo data (demo@clerq.local / clerq-demo)
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

See [CONTRIBUTING.md](CONTRIBUTING.md) for repo layout and conventions.

## Licence

[AGPL-3.0](LICENSE). You can self-host, modify, and redistribute freely;
if you run a modified version as a network service, you must offer its
source to your users. Chosen so the project stays genuinely open.
