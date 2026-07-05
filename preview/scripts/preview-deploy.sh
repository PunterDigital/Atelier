#!/usr/bin/env bash
# Deploy (or update) the preview instance for a single pull request.
#
# Idempotent - safe to run on every push to the PR:
#   1. ensure a per-PR database exists on the shared preview Postgres,
#   2. migrate it and seed the rich Acme dataset (re-runs are no-ops),
#   3. (re)start the app container wired to that database and routed by
#      Traefik at pr-<n>.<base domain>.
#
# Runs on the self-hosted runner, which must be on the same Docker host as the
# preview infrastructure (it uses the host's Docker daemon). Required env (the
# GitHub Actions workflow sets all of these):
#   PR_NUMBER            e.g. 123
#   PREVIEW_BASE_DOMAIN  e.g. preview.useclerq.net
#   IMAGE                e.g. ghcr.io/punterdigital/clerq:pr-123
#   POSTGRES_PASSWORD    superuser password of the shared preview Postgres
#   BETTER_AUTH_SECRET   any fixed secret; previews are throwaway
# Optional:
#   PREVIEW_NETWORK      docker network (default: clerq-preview)
#   COMPOSE_FILE_APP     per-PR app compose (default: preview/docker-compose.app.yml)
set -euo pipefail

PR_NUMBER="${PR_NUMBER:?PR_NUMBER is required}"
PREVIEW_BASE_DOMAIN="${PREVIEW_BASE_DOMAIN:?PREVIEW_BASE_DOMAIN is required}"
IMAGE="${IMAGE:?IMAGE is required}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
export BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET:-preview-secret-not-used-anywhere-real}"
PREVIEW_NETWORK="${PREVIEW_NETWORK:-clerq-preview}"
COMPOSE_FILE_APP="${COMPOSE_FILE_APP:-preview/docker-compose.app.yml}"

DB_NAME="clerq_pr_${PR_NUMBER}"
PREVIEW_HOST="pr-${PR_NUMBER}.${PREVIEW_BASE_DOMAIN}"
PROJECT="clerq-pr-${PR_NUMBER}"
PG_CONTAINER="clerq-preview-postgres"   # container_name in docker-compose.infra.yml

psql_maint() {
  docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CONTAINER}" \
    psql -v ON_ERROR_STOP=1 -U clerq -d postgres "$@"
}

echo "==> Ensuring database ${DB_NAME} exists"
# psql has no CREATE DATABASE IF NOT EXISTS, so guard on pg_database.
if ! psql_maint -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  psql_maint -c "CREATE DATABASE \"${DB_NAME}\""
fi

echo "==> Migrating and seeding ${DB_NAME}"
# The runner reaches the shared Postgres over the preview network. Attach for
# the migrate+seed, then detach on exit - the same trick CI uses in its seed
# job. Both steps talk to Postgres by the container's name on that network.
RUNNER_ID="$(cat /etc/hostname)"
docker network connect "${PREVIEW_NETWORK}" "${RUNNER_ID}" 2>/dev/null || true
trap 'docker network disconnect "${PREVIEW_NETWORK}" "${RUNNER_ID}" 2>/dev/null || true' EXIT

export DATABASE_URL="postgresql://clerq:${POSTGRES_PASSWORD}@${PG_CONTAINER}:5432/${DB_NAME}"
pnpm db:migrate
# seed:acme is idempotent (keyed on the owner email), so this only populates on
# the first deploy; later pushes to the PR leave the established data untouched.
pnpm seed:acme

echo "==> Starting app container ${PROJECT} at https://${PREVIEW_HOST}"
PR_NUMBER="${PR_NUMBER}" \
PREVIEW_HOST="${PREVIEW_HOST}" \
IMAGE="${IMAGE}" \
DATABASE_URL="${DATABASE_URL}" \
BETTER_AUTH_SECRET="${BETTER_AUTH_SECRET}" \
PREVIEW_NETWORK="${PREVIEW_NETWORK}" \
  docker compose -p "${PROJECT}" -f "${COMPOSE_FILE_APP}" up -d --pull always --remove-orphans

echo "==> Preview ready: https://${PREVIEW_HOST}"
