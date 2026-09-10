# API and Domain

`createApp` receives DatabasePort, CachePort, RateLimiterPort, configuration, and logger; it opens no connections. The controller validates input and delegates to the service. The service uses only DatabasePort. `server.ts` creates one Database and one Redis client per process, sharing Redis between cache and limiter. SIGTERM/SIGINT stop accepting connections, drain HTTP, then close PostgreSQL/Redis; a 10-second timeout forces termination if draining blocks.

POST `/shorten` applies rate limiting before JSON parsing (maximum 4,096 bytes), so unavailable Redis returns 503 even for malformed JSON. It validates URL and expiration with security helpers. It generates eight Base62 characters with independent `crypto.randomInt(62)` calls; only CollisionError is retried, up to five attempts, then 503. It returns 201 with `shortCode` and a `shortUrl` based on BASE_URL.

GET `/:code` validates the code and returns a bodyless 302 with Location and `Cache-Control: no-store`. Even on a Redis hit it queries PostgreSQL and uses that result. Missing, expired, or disabled links return a uniform 404 and invalidate cache. SQL read is the consistency point; a later mutation may physically precede the HTTP send. This cache version does not avoid SQL queries. Service disable/delete operations invalidate after SQL; there are no HTTP admin endpoints.

`/health` precedes the dynamic route and checks process health; `/ready` checks PostgreSQL and Redis, returning 503 when PostgreSQL is unavailable and 200/cache-degraded when only Redis fails. Only the exact configured `TRUST_PROXY_IP` peer is trusted, including its IPv4-mapped representation; direct-client Host and X-Forwarded-For cannot change BASE_URL or IP. Requests, bodies, URLs, and IPs are not logged. Responses include restrictive CSP, nosniff, DENY, and no-referrer. Errors are normalized without stacks or internal text; 429 includes Retry-After.

## Gate 4 evidence

`node --import tsx --test tests/api.test.ts`: 5/5 pass, including real HTTP on an ephemeral `127.0.0.1` port. Coverage includes Base62 format, collisions and exhaustion, SQL precedence, expiration/revocation, maintenance invalidation, creation/redirect, headers, untrusted Host, ignored XFF, malformed JSON, 413, rate-before-parse, 429, and degraded readiness. `npx tsc --noEmit` passes. SQL/Redis dependencies are replaced by injected ports in this suite; real resilience, two instances, and shutdown under load require Gate 5 E2E and are not demonstrated here.
