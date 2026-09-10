# Graph Report - url-shortener  (2026-09-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 216 nodes · 392 edges · 23 communities (8 shown, 8 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `d42c14e5`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- AppError
- package.json
- adapters.test.ts
- app.ts
- DatabasePort
- LinkCache
- compilerOptions
- 001_link_api.sql
- test-db.sh
- contracts.test.ts
- concurrency.sh
- migrate.sql
- 001_links.sql
- db-bootstrap.sh
- db-migrate.sh
- setup-env.sh

## God Nodes (most connected - your core abstractions)
1. `AppError` - 23 edges
2. `Link` - 19 edges
3. `Database` - 18 edges
4. `DatabasePort` - 16 edges
5. `LinksService` - 13 edges
6. `CachePort` - 11 edges
7. `LinkCache` - 11 edges
8. `compilerOptions` - 11 edges
9. `PoolPort` - 10 edges
10. `Logger` - 9 edges

## Surprising Connections (you probably didn't know these)
- `fixture()` --calls--> `LinksService`  [EXTRACTED]
  tests/api.test.ts → apps/api/src/modules/links/links.service.ts
- `createApp()` --calls--> `AppError`  [EXTRACTED]
  apps/api/src/app.ts → packages/errors/src/index.ts
- `linksRoutes()` --calls--> `AppError`  [EXTRACTED]
  apps/api/src/modules/links/links.routes.ts → packages/errors/src/index.ts
- `check()` --calls--> `AppError`  [EXTRACTED]
  tests/api.test.ts → packages/errors/src/index.ts
- `startServer()` --calls--> `DistributedRateLimiter`  [EXTRACTED]
  apps/api/src/server.ts → packages/rate-limit/src/index.ts

## Import Cycles
- None detected.

## Communities (23 total, 8 thin omitted)

### Community 0 - "AppError"
Cohesion: 0.10
Nodes (21): LinksController, generateShortCode(), LinksService, AppError, CollisionError, definitions, ErrorCode, DistributedRateLimiter (+13 more)

### Community 1 - "package.json"
Cohesion: 0.05
Nodes (32): dependencies, express, ioredis, ipaddr.js, pg, devDependencies, eslint, tsx (+24 more)

### Community 2 - "adapters.test.ts"
Cohesion: 0.12
Nodes (12): Database, CreateLinkInput, DatabaseOptions, Link, PoolPort, env, FakePool, link (+4 more)

### Community 3 - "app.ts"
Cohesion: 0.18
Nodes (13): AppDependencies, createApp(), linksRoutes(), RateLimiterPort, startServer(), CacheMetrics, createRedisClient(), Config (+5 more)

### Community 5 - "LinkCache"
Cohesion: 0.15
Nodes (4): CacheRedisPort, decode(), LinkCache, FakeRedis

### Community 6 - "compilerOptions"
Cohesion: 0.14
Nodes (13): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, module, moduleResolution, outDir, rootDir, skipLibCheck (+5 more)

### Community 7 - "001_link_api.sql"
Cohesion: 0.29
Nodes (3): link_api.purge_expired_links(), link_api.resolve_link(), link_data.links

### Community 8 - "test-db.sh"
Cohesion: 0.50
Nodes (3): PGPASSWORD, PGUSER, test-db.sh script

## Knowledge Gaps
- **61 isolated node(s):** `ErrorCode`, `RateLimitConfig`, `CacheMetrics`, `SafeMetadata`, `definitions` (+56 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 105 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `AppError` connect `AppError` to `adapters.test.ts`, `app.ts`, `DatabasePort`?**
  _High betweenness centrality (0.087) - this node is a cross-community bridge._
- **Why does `express` connect `AppError` to `package.json`, `app.ts`?**
  _High betweenness centrality (0.063) - this node is a cross-community bridge._
- **Why does `pg` connect `package.json` to `adapters.test.ts`?**
  _High betweenness centrality (0.061) - this node is a cross-community bridge._
- **What connects `ErrorCode`, `RateLimitConfig`, `CacheMetrics` to the rest of the system?**
  _61 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `AppError` be split into smaller, more focused modules?**
  _Cohesion score 0.0951219512195122 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.05405405405405406 - nodes in this community are weakly interconnected._
- **Should `adapters.test.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.125 - nodes in this community are weakly interconnected._