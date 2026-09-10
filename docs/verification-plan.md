# Verification Plan

Gates run in order. Documentation tests do not replace behavior tests. Measured results are recorded in `test-report.md` with commands, date, and limitations.

| Gate | Required evidence | Negative cases |
|---|---|---|
| 1 — contract | HTTP/SQL contracts, diagrams, typecheck | Capacity marked as an assumption |
| 2 — PostgreSQL | Fresh and replayed migration; functions and constraints on a real server | Runtime cannot access tables, sequences, DDL, or administrative operations; collision, invalid URL, invalid expiration |
| 3 — adapters | Parameterized Database, pool shutdown, sanitized errors; cache and config tested | Timeout, disconnect, SQL error; TTL expiration; invalid Redis JSON |
| 4 — application | Controller → service → Database, creation and redirect; security and rate limiting | Five collisions, invalid input, oversized body, Redis error, failed invalidation of disabled link |
| 5 — infrastructure | Two instances, Nginx TLS, persistence, and real Redis | Forged X-Forwarded-For, cross-instance limits, Redis stop/restore, expiration and revocation |
| 6 — acceptance | Lint, typecheck, full suite, architecture, EXPLAIN, and measured load | No table SQL or `pg` import outside Database; measured errors and latency without invented figures |

## Security test policy

Test prohibited schemes, credentials, controls, localhost, non-public names, internal suffixes, private/loopback/link-local/multicast/reserved IPv4, non-global IPv6, and encoded IPv4 forms normalized by WHATWG URL. Never request the destination; blocking domains that resolve to private addresses would require an additional DNS policy and would not guarantee browser rebinding protection.

Verify PostgreSQL, Redis, and JSON errors contain no body, destination, or passwords. Access logs contain only allowed metadata. Nginx overwrites proxy headers and no API publishes its port to the host.

## Result integrity

Tests must fail when dependencies are missing, except for explicitly separated and documented suites; skipped tests are not counted as passes. Load tools must not follow redirects or generate traffic to external destinations. EXPLAIN fixtures run inside a transaction that ends with ROLLBACK. Redis outage tests restore the service even when an assertion fails.
