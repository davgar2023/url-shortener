# PostgreSQL: Setup and Permissions

PostgreSQL 17 is authoritative for identity, uniqueness, and validity. `link_data.links` is in 3NF: every attribute depends on identity and there are no transitive dependencies. One entity needs no foreign key; inventing another table would not improve integrity.

`id` is a UUID primary key and `short_code` has UNIQUE and eight-character Base62 CHECK constraints. URL is required, limited to 2,048 characters, HTTP/HTTPS only, with no whitespace or controls. The application adds detailed destination validation. `created_at` is required; expiration must be later than creation and disable time cannot be earlier. Multiple rows may share a destination. A partial `(expires_at,id) WHERE expires_at IS NOT NULL` index supports ordered purge; UNIQUE supports code lookup.

## Credentials and bootstrap

Generate secrets outside the repository. Export `DB_RUNTIME_PASSWORD`, `DB_MIGRATOR_PASSWORD`, and `DB_MAINTENANCE_PASSWORD`; bootstrap reads them through `psql \\getenv`, with no password literals in SQL files or process arguments. Do not enable shell tracing or `psql echo-all`. Use standard `PGHOST`, `PGPORT`, `PGDATABASE`, `PGUSER`, and `PGPASSWORD` (or pgpass). Never log these variables.

1. As administrator of the dedicated database, run `sh scripts/db-bootstrap.sh`.
2. Connect as `link_migrator` and run `sh scripts/db-migrate.sh`.
3. Repeat migration to verify replayability.

Bootstrap requires an administrator because it creates roles and restricts database access. It is replayable and rotates passwords from environment values. Do not run it on a shared database: it revokes PUBLIC privileges on the database and public schema.

`link_owner` is NOLOGIN and owns schemas, tables, and functions. `link_migrator` is LOGIN NOINHERIT, a member of owner, and explicitly uses SET ROLE for DDL in a transaction. Runtime and maintenance are not owner members. None of the four roles has SUPERUSER, CREATEDB, CREATEROLE, REPLICATION, or BYPASSRLS.

Runtime has CONNECT, USAGE on `link_api`, and EXECUTE only on create/resolve/health. Maintenance has CONNECT, USAGE, and EXECUTE on disable/delete/purge/health. Neither can access tables, the private schema, DDL, or TEMP. SECURITY DEFINER functions belong to owner, fix `search_path=pg_catalog, pg_temp`, and qualify tables. PUBLIC has no EXECUTE, and default EXECUTE is revoked for new owner functions. SQL never constructs dynamic queries from input.

## Migrations and functions

`database/migrate.sql` serializes migrators with a transactional advisory lock. It creates `link_meta.migrations`, applies each version once, and commits the tracker with DDL. Any error rolls back the transaction. Published versions are immutable; add a new version for changes. This lab has no automatic checksums or down migrations; review Git history and restore backups for data recovery.

`create_link(text,text,timestamptz)` returns one row. `resolve_link(text)` returns zero or one current row according to `statement_timestamp()`. `disable_link(uuid)` is idempotent and returns the affected row; `delete_link(uuid)` returns the deleted row. Both return zero rows when absent. Records contain native UUID and timestamptz fields. Database maps them to camelCase and Date. `health()` returns boolean. `purge_expired_links(integer)` accepts 1–10000 and returns deleted count; it uses FOR UPDATE SKIP LOCKED for concurrent workers. It never deletes non-expiring links or replaces logical resolution filtering.

## Real verification and plans

Run with `psql -X -v ON_ERROR_STOP=1 -f <file>` using the indicated login:

| File | Login |
| --- | --- |
| tests/database/constraints.sql | link_migrator |
| tests/database/catalog.sql | link_migrator |
| tests/database/runtime.sql | link_runtime |
| tests/database/maintenance.sql | link_maintenance |
| tests/database/explain.sql | link_migrator |

Tests fail when a constraint or permission is missing. Runtime actually attempts SELECT/INSERT/UPDATE/DELETE, DDL, TEMP, maintenance, and SET ROLE and requires SQLSTATE `insufficient_privilege`; inspecting GRANTs alone is insufficient. Transactions roll back to isolate fixtures. `explain.sql` loads 100,000 deterministic rows, runs ANALYZE and EXPLAIN (ANALYZE, BUFFERS) for lookup and a 100-row purge, then rolls back. Use a test database without codes X0000001–X0100000. The plan targets function SQL so indexes are visible instead of hidden behind Function Scan.

Prepared scripts are not approved results. The project report records the real version, results, and plans when executed.
