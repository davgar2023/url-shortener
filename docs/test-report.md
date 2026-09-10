# Verification Report

## Gate 1 — verified

Date: 2026-09-08. Initial environment: macOS 13.7.8 x86_64, Node.js 20.19.6. Node.js 24.6.0 was also available for later phases.

* `npm install`: dependencies installed. An initial engine warning appeared because the shell used Node 20; the project requires Node >=22.
* `npm run typecheck`: passed.
* `npm run test:contracts`: 3 tests passed, with no failures or skips. The first attempt was blocked by the sandbox while creating the tsx socket; it was repeated with authorization outside the sandbox and passed.

These results verify structure and contracts only, not a functional backend.

## Gate 2 — verified

Real PostgreSQL 17.10 at `127.0.0.1:55432`, using temporary `@embedded-postgres/darwin-x64@17.10.0-beta.17`; psql 16.0 was already installed. No PostgreSQL simulation was used.

* `scripts/db-bootstrap.sh`: roles created with generated passwords, without printing them.
* `scripts/db-migrate.sh`: first and replay migrations passed.
* `tests/database/constraints.sql`: passed, including uniqueness, format, URL scheme, length, nullability, expiration, disable, delete, and bounded purge.
* `tests/database/catalog.sql`: passed, including owners, safe search path, and public privileges.
* `tests/database/runtime.sql`: passed as link_runtime; direct SELECT/INSERT/UPDATE/DELETE, TEMP, DDL, administrative mutations, and role escalation were rejected with `insufficient_privilege`.
* `tests/database/maintenance.sql`: passed with the separate role.

The first database setup failed because Colima download ran out of disk space. Only the incomplete image created by this task was removed; the complete gate was then rerun with `set -eu` and passed. Docker/Colima/Compose deployment remains unverified because local container space is still insufficient.

### Measured concurrency and indexes

`tests/database/concurrency.sh`: twelve runtime connections attempted the same code simultaneously. Result: one creation and eleven SQLSTATE 23505 errors. The fixture was removed through `link_api.delete_link` using maintenance credentials.

`tests/database/explain.sql`, run with psql against PostgreSQL 17.10, loaded 100,000 links, ran ANALYZE, produced two EXPLAIN (ANALYZE, BUFFERS) plans, and rolled back. Full output is in [explain-results.txt](explain-results.txt).

| Query | Observed plan | Sample execution time |
|---|---|---|
| Exact code and validity | Index Scan on `links_short_code_key`, 4 buffers hit | 0.041 ms |
| Purge 100 expired links | `links_expiration_idx` + `links_pkey`, 701 buffers hit | 0.881 ms |

These are local samples with warm buffers and exclude network and HTTP. They are not application QPS measurements or production commitments.
