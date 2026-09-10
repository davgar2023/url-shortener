# Shared Adapters — Gate 3

`loadConfig()` validates startup secrets (DB/Redis at least 16 characters; `RATE_LIMIT_SECRET` 32), ports, limits, base URL, and an explicit proxy peer IP. Errors mention only the variable name. The Config object is never printed. The process creates exactly one `Database(config.database, logger)` and one `createRedisClient(config.redis, logger)` per process and passes them to services; there are no global singletons or request pools. Maintenance uses a separate process and role.

Database keeps `#pool` and `#execute` private at runtime and is the only module importing `pg`. Every query invokes a published function and parameterizes variable arguments. Pool limits include connection, idle, and statement timeouts. SQLSTATE 23505 becomes `CollisionError`; other failures become `AppError.UNAVAILABLE` without SQL details. Pool events log only a safe identifier. `health` maps failures to false. PoolPort injection enables contract tests without opening connections.

`LinkCache` provides get/set/delete/health; counters expose hit/miss/error copies. JSON is validated before dates are mapped. It never writes non-positive TTLs or disabled links and uses PX to bound TTL precisely to expiration. Failed reads, writes, and invalidation are fail-open. The API validates every cache hit with PostgreSQL, whose result wins. ioredis is shared with the rate limiter, disables offline queuing, and uses bounded timeouts and reconnects; the composition root calls `redis.quit()`/`disconnect()` on shutdown. CachePort supports fakes without Redis.

`AppError` fixes status, code, and public message; `CollisionError` remains internal. The logger serializes only restricted events and enumerated metadata, never URLs, headers, SQL, original errors, or secrets.

Reproducible verification: `node --import tsx --test tests/adapters.test.ts` and `npm run typecheck`. Pool tests cover encapsulation, parameters, mapping, shutdown, and sanitization; cache tests cover TTL, invalid JSON, expiration, and degradation; configuration and logging include adversarial tests. These tests do not replace real PostgreSQL Gate 2 tests or Gate 5 E2E.
