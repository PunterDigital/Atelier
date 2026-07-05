# PR preview environments (Coolify)

Spin up an isolated, fully-seeded Clerq instance for every open pull request,
and tear it down when the PR closes — using [Coolify](https://coolify.io)'s
built-in Preview Deployments. Open a PR → Coolify builds that branch, comments
a URL like `https://pr-123-clerq.preview.useclerq.net` on the PR, and runs it
against its own database preloaded with the rich **Acme** dataset (lots of
clients, projects, tasks, weeks of tracked time, expenses, and invoices across
every status and tax treatment). Close or merge the PR → Coolify removes it.

Coolify handles the whole lifecycle (build, URL, TLS, teardown) natively, so
this repo only needs to describe the stack. That's [`docker-compose.coolify.yml`](./docker-compose.coolify.yml):
app + Postgres + a one-shot seeder, giving each PR its own isolated database.

## Why this fits Clerq

- **All state lives in Postgres** (receipts and logos are stored inline in the
  DB — no blob store), so a preview is just one app container + one database.
- The container **self-migrates on boot**, and the seeder reuses the existing
  Dockerfile `builder` stage to run the exact `pnpm db:migrate && pnpm seed:acme`
  that CI already runs — **no Dockerfile or app changes needed**.
- Clerq already targets single-container platforms like Coolify (see the note in
  `scripts/migrate.ts`), so nothing here works against the grain.

## One-time setup

### 1. Stand up Coolify
Install Coolify on a fresh VPS (any provider; a small 4 GB box is plenty to
start — each preview is ~150 MB for the app plus a small Postgres):

```bash
curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash
```

Then open Coolify and connect it to GitHub via a **GitHub App** (Coolify →
Sources), granting it access to `PunterDigital/clerq`. The GitHub App is what
lets Coolify receive PR webhooks and post preview URLs back on the PR.

### 2. Wildcard DNS
Point a wildcard at the Coolify host so each preview gets a subdomain:

```
*.preview.useclerq.net.   A   <coolify-host-ip>
```

Set this wildcard as the resource's domain in Coolify so previews resolve to
`pr-<n>-clerq.preview.useclerq.net`. Coolify issues Let's Encrypt certs
automatically.

### 3. Create the resource
In a Coolify project: **+ New → Docker Compose**, choose the GitHub App source
and the `clerq` repo, and set the compose path to:

```
preview/docker-compose.coolify.yml
```

Set two environment variables on the resource (mark them **available at build
time** and for **preview deployments**):

| Name | Value |
|---|---|
| `POSTGRES_PASSWORD` | any strong string |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` |

### 4. Enable previews
On the resource: **Preview Deployments → enable**, and turn on **Auto-stop on
PR close** (removes the environment when the PR merges or closes). That's it.

Open a PR and within a few minutes Coolify comments the URL. Sign in with the
seeded account: `owner@acme.test` / `acme-demo-1234`.

## Two things to verify on the first preview

Coolify's compose magic differs slightly across versions, so confirm these once:

1. **App → Postgres connection.** The compose uses the service name `postgres`
   in `DATABASE_URL`. Coolify keeps a stack's services on one network, so this
   normally resolves; if a build can't reach the DB, use Coolify's
   `SERVICE_NAME_*` magic var for the Postgres host (Coolify → the service's
   env), which resolves to the per-PR service name.
2. **Public URL → `BETTER_AUTH_URL`.** The compose asks Coolify to generate a
   domain for `app` (`SERVICE_FQDN_APP_3000`) and feeds it to `BETTER_AUTH_URL`.
   If login redirects look wrong, set `BETTER_AUTH_URL` explicitly as a
   preview-only env var in the Coolify UI to the generated preview URL.

## Notes

- **Isolation:** each PR gets a fresh Postgres volume, so previews never share
  data and teardown is clean.
- **Updates:** every push to the PR rebuilds and redeploys; the seeder is
  idempotent (`seed:acme` is keyed on the owner email), so re-runs are no-ops.
- **Cost/scale:** the app is ~150 MB idle; tens of concurrent previews fit on a
  modest VPS. Scale the box up if you routinely run many at once.
- **Orphans:** if the auto-stop webhook ever misfires, Coolify lists active
  previews under the resource's Preview Deployments tab — stop them there.
- **Clean state:** the `seed` service drops and recreates the schema before
  migrating, so a preview always seeds fresh even though Coolify keeps the
  per-PR Postgres volume across redeploys. (Without it, leftover tables from an
  interrupted deploy make `drizzle-kit migrate` fail with a swallowed "relation
  already exists" and the deploy dies with no visible error.)
- **Housekeeping:** failed deploys can leave stopped containers behind (Coolify
  runs `up` without `--remove-orphans`). They only waste disk, but to clear
  them: `docker container prune -f` and `docker volume prune -f` on the host.

## Production is separate

This compose is preview-only: it builds from source and always seeds. Production
self-hosting still uses the root `docker-compose.yml`, which pulls the released
image and never seeds.
