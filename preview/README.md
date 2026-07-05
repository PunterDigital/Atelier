# PR preview environments

Spin up an isolated, fully-seeded Clerq instance for every open pull request,
and tear it down when the PR closes. Open a PR → a comment appears with a URL
like `https://pr-123.preview.useclerq.net`, running that PR's exact code
against its own database preloaded with the rich **Acme** dataset (lots of
clients, projects, tasks, weeks of tracked time, expenses, and invoices across
every status and tax treatment). Close the PR → it's gone.

This is the "roll-your-own on your own host" approach. It reuses what Clerq
already has - the self-hosted CI runner, the image that builds from source, the
idempotent `seed:acme` script, and the self-migrating container - so there is
very little new machinery.

## Why this is cheap here

Clerq is unusually preview-friendly: **all state lives in Postgres** (receipts
and logos are stored inline in the database - there is no S3 or upload volume),
and the container is stateless and fully env-configured. So a preview is just
**one app container + one database**, and "tens of instances" means one shared
Postgres with a database per PR plus a handful of small Node processes. Rough
sizing: each app is ~100-150 MB idle, so ~30 previews + a shared Postgres fit
comfortably on a single **8 GB / 2-4 vCPU** VM.

## How it works

```
PR opened / pushed ─► preview-deploy.yml (self-hosted runner)
                        ├─ build & push  ghcr.io/punterdigital/clerq:pr-<n>
                        ├─ create database  clerq_pr_<n>
                        ├─ migrate + seed:acme  (from the runner)
                        ├─ start app container  clerq-pr-<n>  (Traefik routes it)
                        └─ comment  https://pr-<n>.<base domain>  on the PR

PR closed / merged ─► preview-teardown.yml ─► stop container + DROP DATABASE
Daily 03:00 UTC    ─► preview-reap.yml      ─► reap previews for any closed PR
```

Files in this directory:

| File | Purpose |
|---|---|
| `docker-compose.infra.yml` | Long-lived Traefik + shared Postgres. Brought up once. |
| `docker-compose.app.yml` | The per-PR app container template. |
| `traefik/dynamic.yml` | TLS options + optional basic-auth middleware. |
| `scripts/preview-deploy.sh` | Create DB, migrate, seed, start the app. |
| `scripts/preview-teardown.sh` | Stop the app, drop the DB. |
| `scripts/preview-reap.sh` | Reap previews whose PR is no longer open. |
| `.env.example` | Env for the one-time infra bring-up. |

The workflows live in `.github/workflows/preview-*.yml`.

## One-time setup

### 1. A host with Docker and your self-hosted runner

These workflows run on `[self-hosted, linux]` and drive the **host's Docker
daemon directly**, so the runner must be on the same host as the preview infra.
(If your runner lives elsewhere, point `DOCKER_HOST`/a Docker context at the
preview host, or run the scripts over SSH - the scripts themselves are plain
Docker commands.)

### 2. Wildcard DNS

Point a wildcard record at the host so every PR subdomain resolves:

```
*.preview.useclerq.net.  A  <host-public-ip>
```

### 3. Bring up the infrastructure (once)

```bash
docker network create clerq-preview
cd preview
cp .env.example .env        # set POSTGRES_PASSWORD and ACME_EMAIL
docker compose -f docker-compose.infra.yml --env-file .env up -d
```

Traefik gets TLS certs automatically via Let's Encrypt (HTTP-01), so ports
**80 and 443 must be reachable from the internet**.

### 4. GitHub configuration

- **Repo variable** `PREVIEW_BASE_DOMAIN` = `preview.useclerq.net`
- **Repo secrets:**
  - `PREVIEW_POSTGRES_PASSWORD` - must equal `POSTGRES_PASSWORD` from step 3
  - `PREVIEW_BETTER_AUTH_SECRET` - any value (`openssl rand -base64 32`); previews are throwaway
- **GHCR:** the built `:pr-<n>` images are private by default. Because the
  self-hosted runner logs in to GHCR during deploy, the host can pull them - no
  extra step needed. If you deploy from a different host, log that host's Docker
  in to GHCR too.

Setting `PREVIEW_BASE_DOMAIN` is the on-switch: until it's present the preview
workflows are **skipped** (not failed), so they never redden CI before the host
is ready. Once it's set, open a PR to try it.

## Security

- **Fork PRs are excluded.** The workflows guard on
  `head.repo.full_name == github.repository`, so untrusted code never builds or
  runs on your host with your secrets. Previews are for same-repo branches
  (which is how the maintainer's own PRs are created).
- **No live third-party keys in previews.** `docker-compose.app.yml` sets
  neither `GROQ_API_KEY` nor Google OAuth - a public throwaway URL shouldn't
  carry real credentials.
- **Optional basic auth.** If the host is internet-facing and you don't want
  previews openly reachable, add a bcrypt hash to `traefik/dynamic.yml` and
  uncomment the `preview-auth@file` middleware label in
  `docker-compose.app.yml`.

## TLS at scale: HTTP-01 vs. DNS-01

The default HTTP-01 challenge needs no DNS-provider credentials, but Let's
Encrypt limits **50 certificates per registered domain per week**. If your PR
throughput could exceed that, switch Traefik to a **DNS-01 wildcard** cert -
one `*.preview.useclerq.net` cert covers every subdomain and sidesteps the
limit. Replace the `httpchallenge` lines in `docker-compose.infra.yml` with,
for example (Cloudflare):

```yaml
- --certificatesresolvers.le.acme.dnschallenge=true
- --certificatesresolvers.le.acme.dnschallenge.provider=cloudflare
```

and pass `CF_DNS_API_TOKEN` to the traefik service. See the Traefik ACME docs
for other providers.

## Database model

One **shared Postgres** with a **database per PR** (`clerq_pr_<n>`), rather than
a Postgres container per PR. Denser and cheaper for tens of instances; teardown
is a single `DROP DATABASE ... WITH (FORCE)`. If you'd rather have hard
isolation (separate Postgres per PR), add a `postgres` service to
`docker-compose.app.yml` and point `DATABASE_URL` at it - the rest is unchanged.

## Operating notes

- **Updates:** every push to a PR rebuilds the image and restarts its
  container. `seed:acme` is idempotent, so the dataset is established once on
  first deploy and left intact afterwards.
- **Migrations:** the runner migrates the DB before starting the container,
  which runs with `CLERQ_SKIP_MIGRATIONS=1` so two migrators never race.
- **Manual teardown:** `PR_NUMBER=123 POSTGRES_PASSWORD=… bash
  preview/scripts/preview-teardown.sh`.
- **Leaks:** the daily reaper drops any `clerq_pr_*` database whose PR is no
  longer open, covering close events the webhook missed.

## Not sure this is the right approach?

This directory is the self-hosted, most-control, lowest-cost option. Two
alternatives trade control for less to operate:

- **Coolify** (self-hostable, open-source PaaS) has PR preview deploys and
  teardown-on-merge nearly built in - a good fit if you'd rather configure than
  maintain shell + compose glue.
- **Managed PaaS** (Render, Railway, Northflank) offer native preview
  environments from a config file with almost no ops, at a per-instance cost.

Both map onto the same architecture above; only the operator burden differs.
