import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Database } from '../packages/database/src/Database.js';
import type { DatabaseOptions, Link, PoolPort } from '../packages/database/src/database.types.js';
import { AppError, CollisionError } from '../packages/errors/src/index.js';
import { createLogger } from '../packages/logger/src/index.js';
import { loadConfig } from '../packages/config/src/index.js';
import { LinkCache, type CacheRedisPort } from '../packages/cache/src/index.js';
const logs: string[] = [];
const logger = createLogger(line => logs.push(line));
const options: DatabaseOptions = { host: 'db', port: 5432, database: 'links', user: 'runtime', password: 'secret', max: 10, connectionTimeoutMillis: 2000, idleTimeoutMillis: 30000, statement_timeout: 5000 };
const link: Link = { id: '11111111-1111-4111-8111-111111111111', shortCode: 'Ab12Cd34', url: 'https://example.org/', createdAt: new Date('2026-01-01T00:00:00.000Z'), expiresAt: null, disabledAt: null };
const row = { id: link.id, short_code: link.shortCode, url: link.url, created_at: link.createdAt, expires_at: null, disabled_at: null };
class FakePool implements PoolPort {
  calls: { text: string; values: unknown[] }[] = []; rows: Record<string, unknown>[] = [row]; failure: unknown; ended = false; errorHandler?: (error: Error) => void;
  async query(text: string, values: unknown[] = []) { this.calls.push({ text, values }); if (this.failure) throw this.failure; return { rows: this.rows }; }
  on(_event: 'error', handler: (error: Error) => void) { this.errorHandler = handler; }
  async end() { this.ended = true; }
}
test('Database hides pool and query, parameterizes all function calls and maps nullable links', async () => {
  const pool = new FakePool(); let passed: DatabaseOptions | undefined;
  const db = new Database(options, logger, config => { passed = config; return pool; });
  assert.equal(passed, options); assert.equal('pool' in db, false); assert.equal('query' in db, false); assert.equal('execute' in db, false);
  const malicious = "x'; DROP TABLE links; --";
  assert.deepEqual(await db.createLink({ shortCode: malicious, url: link.url, expiresAt: null }), link);
  assert.deepEqual(pool.calls[0].values, [malicious, link.url, null]); assert.ok(!pool.calls[0].text.includes(malicious));
  assert.deepEqual(await db.resolveLink(link.shortCode), link); assert.deepEqual(await db.disableLink(link.id), link); assert.deepEqual(await db.deleteLink(link.id), link);
  pool.rows = []; assert.equal(await db.resolveLink('AAAAAAAA'), null); assert.equal(await db.disableLink(link.id), null); assert.equal(await db.deleteLink(link.id), null);
  pool.rows = [{ count: 5 }]; assert.equal(await db.purgeExpiredLinks(100), 5);
  await assert.rejects(db.purgeExpiredLinks(0), AppError); await assert.rejects(db.purgeExpiredLinks(10001), AppError);
  assert.ok(pool.calls.every(call => /^SELECT (?:\* FROM )?link_api\.(?:create_link|resolve_link|disable_link|delete_link|purge_expired_links)\(/.test(call.text)));
  pool.rows = [{ healthy: true }]; assert.equal(await db.health(), true); await db.close(); assert.equal(pool.ended, true);
});
test('Database sanitizes SQL and idle pool errors; only 23505 is a collision', async () => {
  const pool = new FakePool(); const db = new Database(options, logger, () => pool);
  pool.failure = { code: '23505', message: 'secret SQL url' }; await assert.rejects(db.resolveLink('AAAAAAAA'), CollisionError);
  pool.failure = { code: '42501', message: 'secret SQL url' };
  await assert.rejects(db.resolveLink('AAAAAAAA'), error => error instanceof AppError && error.code === 'UNAVAILABLE' && !('cause' in error) && !error.message.includes('SQL'));
  assert.equal(await db.health(), false); pool.errorHandler?.(new Error('secret SQL url')); assert.ok(!logs.at(-1)?.includes('secret'));
});
class FakeRedis implements CacheRedisPort {
  value: string | null = null; ttl = 0; removed = 0; failure = false;
  async get() { if (this.failure) throw new Error('secret'); return this.value; }
  async set(_key: string, value: string, _mode: 'PX', ttl: number) { if (this.failure) throw new Error('secret'); this.value = value; this.ttl = ttl; }
  async del() { if (this.failure) throw new Error('secret'); this.removed++; this.value = null; }
  async ping() { if (this.failure) throw new Error('secret'); return 'PONG'; }
}
test('cache TTL is bounded by expiry, values validated and expired/disabled never cached', async () => {
  const redis = new FakeRedis(); const now = Date.parse('2026-02-01T00:00:00.000Z'); const cache = new LinkCache(redis, 60, logger, () => now);
  assert.equal(await cache.get(link.shortCode), null); await cache.set(link); assert.equal(redis.ttl, 60000); assert.deepEqual(await cache.get(link.shortCode), link);
  await cache.set({ ...link, expiresAt: new Date(now + 1200) }); assert.equal(redis.ttl, 1200);
  redis.value = null; await cache.set({ ...link, expiresAt: new Date(now) }); assert.equal(redis.value, null);
  await cache.set({ ...link, disabledAt: new Date(now) }); assert.equal(redis.value, null);
  for (const raw of ['null', '{}', JSON.stringify({ ...link, shortCode: 'wrong' }), JSON.stringify({ ...link, createdAt: 'bad' }), JSON.stringify({ ...link, expiresAt: new Date(now) })]) { redis.value = raw; assert.equal(await cache.get(link.shortCode), null); }
  assert.equal(redis.removed, 5); redis.value = '{malformed'; assert.equal(await cache.get(link.shortCode), null); assert.equal(cache.metrics.error, 1);
  assert.equal(await cache.health(), true);
});
test('cache failures fail open for all methods and emit safe counters', async () => {
  const redis = new FakeRedis(); redis.failure = true; const cache = new LinkCache(redis, 60, logger);
  assert.equal(await cache.get(link.shortCode), null); await cache.set(link); await cache.delete(link.shortCode); assert.equal(await cache.health(), false);
  assert.deepEqual(cache.metrics, { hit: 0, miss: 1, error: 3 });
});
const env = { DB_HOST: 'db', DB_NAME: 'links', DB_USER: 'runtime', DB_PASSWORD: 'a'.repeat(32), REDIS_HOST: 'redis', REDIS_PASSWORD: 'b'.repeat(32), RATE_LIMIT_SECRET: 'c'.repeat(32), BASE_URL: 'https://short.example/', TRUST_PROXY_IP: '172.28.0.10', INSTANCE_ID: 'api-1' };
test('configuration validates required secrets, trusted peer, URLs, integer bounds without secret leakage', () => {
  const config = loadConfig(env); assert.equal(config.baseUrl, 'https://short.example'); assert.equal(config.database.max, 10);
  for (const bad of [{ DB_PASSWORD: 'short' }, { RATE_LIMIT_SECRET: '' }, { PORT: '3e3' }, { DB_POOL_MAX: '101' }, { BASE_URL: 'https://user:password@example.org' }, { BASE_URL: 'https://example.org/path' }, { TRUST_PROXY_IP: '*' }, { INSTANCE_ID: 'bad\nvalue' }]) assert.throws(() => loadConfig({ ...env, ...bad }), /Invalid configuration:/);
  assert.throws(() => loadConfig({ ...env, DB_PASSWORD: 'secret' }), error => error instanceof Error && !error.message.includes('secret'));
});
test('logger never serializes arbitrary URL, headers or error objects', () => {
  const output: string[] = []; const safeLogger = createLogger(line => output.push(line));
  safeLogger.error('request.failed', { status: 503, operation: 'resolve', url: 'https://secret', password: 'secret', error: new Error('secret') } as never);
  safeLogger.info('https://secret', { operation: 'https://secret' }); assert.ok(output.every(line => !line.includes('secret')));
});
