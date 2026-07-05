#!/usr/bin/env bash
# Safety net: tear down previews whose PR is no longer open.
#
# The close webhook can be missed (a network blip, or the PR closed while
# Actions was down), which would leak a database and a container. This reaper
# lists every per-PR database, asks GitHub whether that PR is still open, and
# tears down the ones that aren't. Meant to run on a daily schedule.
#
# Required env:
#   POSTGRES_PASSWORD  superuser password of the shared preview Postgres
#   GH_TOKEN           token with read access to the repo's pull requests
# Optional:
#   GITHUB_REPOSITORY  owner/repo (default: PunterDigital/clerq)
set -euo pipefail

POSTGRES_PASSWORD="${POSTGRES_PASSWORD:?POSTGRES_PASSWORD is required}"
GH_TOKEN="${GH_TOKEN:?GH_TOKEN is required}"
REPO="${GITHUB_REPOSITORY:-PunterDigital/clerq}"
PG_CONTAINER="clerq-preview-postgres"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

mapfile -t DBS < <(docker exec -e PGPASSWORD="${POSTGRES_PASSWORD}" "${PG_CONTAINER}" \
  psql -U clerq -d postgres -tAc \
  "SELECT datname FROM pg_database WHERE datname LIKE 'clerq_pr_%'")

for db in "${DBS[@]}"; do
  [ -z "$db" ] && continue
  pr="${db#clerq_pr_}"
  # Ask the API for this PR's state. Uses grep/sed to avoid a jq dependency;
  # swap in `jq -r .state` if it's available on your runner.
  state="$(curl -sS \
    -H "Authorization: Bearer ${GH_TOKEN}" \
    -H "Accept: application/vnd.github+json" \
    "https://api.github.com/repos/${REPO}/pulls/${pr}" \
    | grep -m1 '"state"' | sed -E 's/.*"state":[[:space:]]*"([^"]+)".*/\1/')"

  if [ "${state}" = "open" ]; then
    echo "PR #${pr}: open - keeping"
  else
    echo "PR #${pr}: '${state:-unknown}' - reaping"
    PR_NUMBER="${pr}" POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
      bash "${SCRIPT_DIR}/preview-teardown.sh" || true
  fi
done
