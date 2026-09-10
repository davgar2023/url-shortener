# Integration Contracts — Phase 1

This contract is the reference for later phases. Phase tests verify its presence and consistency; later phases verify actual behavior.

## HTTP

* `POST /shorten`: JSON `{ "url": "https://example.org/path", "expiresAt": "2030-01-01T00:00:00.000Z" }`. `expiresAt` is optional but must be a valid future ISO date when present. Success: `201` with `{ "shortCode": "Ab12Cd34", "shortUrl": "https://short.example/Ab12Cd34" }`. The short URL comes from `BASE_URL`, never the received Host.
* `GET /:code`: exactly eight Base62 characters (`^[A-Za-z0-9]{8}$`). Success: `302`, Location with the original destination, and `Cache-Control: no-store`. Unknown, expired, or disabled: uniform `404`. Invalid code: `400`.
* `GET /health`: process availability. `GET /ready`: PostgreSQL availability; degraded Redis is reported without blocking GET. Never expose credentials, URLs, or infrastructure details.
* Uniform error: `{ "error": { "code": "INVALID_INPUT", "message": "Invalid input" } }`. Codes: `INVALID_INPUT` (400), `NOT_FOUND` (404), `PAYLOAD_TOO_LARGE` (413), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500), `UNAVAILABLE` (503). 429 responses include `Retry-After` seconds. Malformed JSON is 400.
* URL maximum: 2,048 characters; body maximum: 4,096 bytes. HTTP/HTTPS only; reject credentials, control whitespace, and private/local destinations. The application never requests the destination.

## Domain and database

```typescript
interface Link {
  id: string; // UUID
  shortCode: string;
  url: string;
  createdAt: Date;
  expiresAt: Date | null;
  disabledAt: Date | null;
}
interface CreateLinkInput {
  shortCode: string;
  url: string;
  expiresAt: Date | null;
}
interface DatabasePort {
  createLink(input: CreateLinkInput): Promise<Link>;
  resolveLink(code: string): Promise<Link | null>;
  disableLink(id: string): Promise<Link | null>;
  deleteLink(id: string): Promise<Link | null>;
  purgeExpiredLinks(batchSize: number): Promise<number>;
  health(): Promise<boolean>;
  close(): Promise<void>;
}
```

`resolveLink` returns null when absent, expired (`expires_at <= statement_timestamp()`), or disabled. PostgreSQL decides validity and uniqueness. Disable/delete return the affected record for cache invalidation; absent returns null. Disable is idempotent. Purge accepts 1–10,000 records per batch.

`Database` is the only importer of `pg` and the only owner of one pool per process. It exposes no arbitrary query. Each method calls only its parameterized `link_api` function. A uniqueness violation (`23505`) becomes a typed collision error and permits up to five creation attempts; exhaustion returns 503. Other SQL errors never reach clients.

## Cache and limits

Cache-aside key `link:<code>`, serialized Link value with ISO dates, configured TTL bounded by expiration. Non-positive TTL prevents writes. Negative results are never cached. Every hit still calls `Database.resolveLink`; PostgreSQL wins. A null result deletes the entry and returns 404. This prevents stale redirects after disable even if Redis or invalidation fails.

Service maintenance methods invalidate after disable/delete; physical purge does not replace logical expiration checks. Record hit/miss/error counters without URLs. The explicit cost is one PostgreSQL read per GET, including cache hits, prioritizing correct revocation over SQL QPS savings.

Rate limiting uses atomic Redis execution by IP and operation: creation (10/minute), redirect (120/minute), and global per IP (200/minute), all configurable. Rejects return 429 and Retry-After. Redis unavailable: POST returns 503 and GET queries PostgreSQL. Nginx provides basic local protection. API, PostgreSQL, and Redis have no public ports.

## Responsibilities and gates

`apps/api` contains controller → LinksService → Database. `packages/database` implements published SQL and pooling; `cache` adapts Redis; `security` validates input and headers; `rate-limit` implements distributed counters; `config` validates environment; `logger` writes safe metadata. SQL lives in `database/{migrations,functions,roles}`. Compose and proxy belong in `infra`.

1. **Gate 1:** structure, contracts, design, and documentation tests pass before implementation.
2. **Gate 2:** migrations, constraints, functions, roles, and permission denial are verified on real PostgreSQL.
3. **Gate 3:** typed Database and shared packages, pool, and adapters are tested.
4. **Gate 4:** domain, API, security, and cache are integrated and tested.
5. **Gate 5:** Compose with two instances, E2E, balancing, distributed limiting, and resilience.
6. **Gate 6:** lint, typecheck, full suite, architecture, EXPLAIN, and measured load; README and report match results. Never declare an unexecuted gate complete.
