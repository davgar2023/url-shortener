#!/bin/sh
set -eu
base=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
exec psql -X -v ON_ERROR_STOP=1 -f "$base/database/migrate.sql" "$@"
