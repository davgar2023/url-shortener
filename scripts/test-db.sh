#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
: "${DB_MIGRATOR_PASSWORD:?required}" "${DB_RUNTIME_PASSWORD:?required}" "${DB_MAINTENANCE_PASSWORD:?required}"
export PGUSER=link_migrator PGPASSWORD="$DB_MIGRATOR_PASSWORD"
sh scripts/db-migrate.sh
sh scripts/db-migrate.sh
psql -X -v ON_ERROR_STOP=1 -f tests/database/constraints.sql
psql -X -v ON_ERROR_STOP=1 -f tests/database/catalog.sql
export PGUSER=link_runtime PGPASSWORD="$DB_RUNTIME_PASSWORD"
psql -X -v ON_ERROR_STOP=1 -f tests/database/runtime.sql
export PGUSER=link_maintenance PGPASSWORD="$DB_MAINTENANCE_PASSWORD"
psql -X -v ON_ERROR_STOP=1 -f tests/database/maintenance.sql
echo 'Database constraints, migration replay and role permissions passed.'
