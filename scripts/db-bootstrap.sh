#!/bin/sh
set -eu
: "${DB_RUNTIME_PASSWORD:?required}" "${DB_MAINTENANCE_PASSWORD:?required}" "${DB_MIGRATOR_PASSWORD:?required}"
base=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec psql -X -v ON_ERROR_STOP=1 -f "$base/database/roles/bootstrap.sql" "$@"
