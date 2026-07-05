#!/usr/bin/env bash
# Tear down the preview instance for a pull request: stop the app container and
# drop its database. Runs when the PR is closed or merged. Idempotent - safe to
# run even if the preview was never created or is already gone.
#
# Required env:
#   PR_NUMBER          e.g. 123
#   POSTGRES_PASSWORD  superuser password of the shared preview Postgres
# Optional:
#   COMPOSE_FILE_APP   per-PR app compose (default: preview/docker-compose.app.yml)
set -euo pipefail

PR_NUMBER="${PR_NUMBER:?PR_NUMBER is required}"
POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
COMPOSE_FILE_APP="${COMPOSE_FILE_APP:-preview/docker-compose.app.yml}"

DB_NAME="clerq_pr_${PR_NUMBER}"
PROJECT="clerq-pr-${PR_NUMBER}"
PG_CONTAINER="clerq-preview-postgres"

echo "==> Stopping app container ${PROJECT}"
# The env vars below only let compose parse the file; their values don't matter
# for `down`. `|| true` keeps teardown idempotent if the project is already gone.
PR_NUMBER="${PR_NUMBER}" PREVIEW_HOST="x" IMAGE="x" DATABASE_URL="x" \
  docker compose -p "${PROJECT}" -f "${COMPOSE_FILE_APP}" down --remove-orphans || true

echo "==> Dropping database ${DB_NAME}"
# WITH (FORCE) (Postgres 13+, we run 17) evicts the app's lingering connections
# so the drop doesn't fail on "database is being accessed by other users".
docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CONTAINER}" \
  psql -U clerq -d postgres -c "DROP DATABASE IF EXISTS \"${DB_NAME}\" WITH (FORCE)" || true

echo "==> Preview for PR #${PR_NUMBER} torn down"
