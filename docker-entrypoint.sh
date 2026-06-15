#!/bin/sh
# Container entrypoint: apply database migrations, then start the server.
#
# Running migrations here means one image self-migrates on boot, so the same
# container works on docker-compose and on single-container platforms alike.
# migrate.mjs no-ops when CLERQ_SKIP_MIGRATIONS is set; `set -e` aborts the
# boot if a migration fails, rather than serving against a half-migrated
# database.
set -e

node /app/migrate.mjs
exec node /app/server.js
