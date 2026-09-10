import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { AddressInfo } from 'node:net';
import { createApp } from '../apps/api/src/app.js';
import { LinksService, generateShortCode } from '../apps/api/src/modules/links/links.service.js';
import { AppError, CollisionError } from '../packages/errors/src/index.js';
import type { DatabasePort, Link } from '../packages/database/src/database.types.js';
import type { CachePort } from '../packages/cache/src/index.js';
const row: Link = { id: '00000000-0000-0000-0000-000000000001', shortCode: 'Ab12Cd34', url: 'https://example.org/path', createdAt: new Date(), expiresAt: null, disabledAt: null };
function fixture() {
  let current: Link | null = { ...row }; let cached: Link | null = null; let reads = 0; let attempts = 0; let collisions = 0; let dbHealthy = true; let redisHealthy = true;
  const database: DatabasePort = { async createLink(input) { attempts++; if (attempts <= collisions) throw new CollisionError(); current = { ...row, ...input }; return current; }, async resolveLink() { reads++; return current; }, async disableLink() { if (current) current = { ...current, disabledAt: new Date() }; return current; }, async deleteLink() { const old = current; current = null; return old; }, async purgeExpiredLinks() { return 0; }, async health() { return dbHealthy; }, async close() {} };
  const cache: CachePort = { async get() { return cached; }, async set(link) { cached = link; }, async delete() { cached = null; }, async health() { return redisHealthy; } };
  return { database, cache, service: new LinksService(database, cache, 'https://s.example', () => row.shortCode), setCurrent(value: Link | null) { current = value; }, setCached(value: Link | null) { cached = value; }, setCollisions(value: number) { collisions = value; }, health(db: boolean, redis: boolean) { dbHealthy = db; redisHealthy = redis; }, get reads() { return reads; }, get attempts() { return attempts; }, get cached() { return cached; } };
}
test('crypto generator produces eight Base62 characters', () => { for (let i = 0; i < 500; i++) assert.match(generateShortCode(), /^[A-Za-z0-9]{8}$/); });
test('creation retries typed collisions, caps five attempts and caches success', async () => {
  const f = fixture(); f.setCollisions(4); assert.deepEqual(await f.service.shorten({ url: row.url, expiresAt: null }), { shortCode: row.shortCode, shortUrl: `https://s.example/${row.shortCode}` }); assert.equal(f.attempts, 5); assert.equal(f.cached?.url, row.url);
  const failure = fixture(); failure.setCollisions(5); await assert.rejects(failure.service.shorten({ url: row.url, expiresAt: null }), { code: 'UNAVAILABLE' }); assert.equal(failure.attempts, 5);
});
test('cache hit always checks SQL; SQL wins and revoked or expired links never redirect', async () => {
  const f = fixture(); f.setCached({ ...row, url: 'https://stale.example/' }); assert.equal((await f.service.resolve(row.shortCode)).url, row.url); assert.equal(f.reads, 1);
  f.setCurrent(null); await assert.rejects(f.service.resolve(row.shortCode), { code: 'NOT_FOUND' }); assert.equal(f.cached, null);
  f.setCurrent({ ...row, expiresAt: new Date(Date.now() - 1) }); await assert.rejects(f.service.resolve(row.shortCode), { code: 'NOT_FOUND' });
  f.setCurrent({ ...row, disabledAt: new Date() }); await assert.rejects(f.service.resolve(row.shortCode), { code: 'NOT_FOUND' });
});
test('maintenance invalidates populated cache', async () => { const f = fixture(); f.setCached(row); await f.service.disableLink(row.id); assert.equal(f.cached, null); f.setCached(row); await f.service.deleteLink(row.id); assert.equal(f.cached, null); });
test('HTTP routing, headers, validation, rate order, proxy trust, and readiness', async () => {
  const f = fixture(); let rejectCreate = false; let limited = false; const observed: string[] = [];
  const app = createApp({ database: f.database, cache: f.cache, limiter: { async check(ip, operation) { observed.push(ip); if (limited) throw new AppError('RATE_LIMITED', 17); if (rejectCreate && operation === 'create') throw new AppError('UNAVAILABLE'); } }, config: { baseUrl: 'https://s.example', trustProxyIp: '192.0.2.10', instanceId: 'api-1' }, logger: { info() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve)); const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  try {
    assert.equal((await fetch(`${base}/health`)).status, 200);
    let response = await fetch(`${base}/shorten`, { method: 'POST', headers: { 'Content-Type': 'application/json', Host: 'evil.example', 'X-Forwarded-For': '8.8.8.8' }, body: JSON.stringify({ url: row.url }) });
    assert.equal(response.status, 201); assert.match((await response.json()).shortUrl, /^https:\/\/s\.example\/[A-Za-z0-9]{8}$/); assert.equal(observed[0], '127.0.0.1');
    response = await fetch(`${base}/${row.shortCode}`, { redirect: 'manual' }); assert.equal(response.status, 302); assert.equal(response.headers.get('location'), row.url); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff'); assert.equal(response.headers.get('x-powered-by'), null);
    response = await fetch(`${base}/shorten`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }); assert.equal(response.status, 400);
    response = await fetch(`${base}/shorten`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: 'x'.repeat(5000) }) }); assert.equal(response.status, 413);
    rejectCreate = true; response = await fetch(`${base}/shorten`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' }); assert.equal(response.status, 503);
    assert.equal((await fetch(`${base}/invalid`)).status, 400);
    limited = true; response = await fetch(`${base}/${row.shortCode}`); assert.equal(response.status, 429); assert.equal(response.headers.get('retry-after'), '17'); limited = false;
    f.health(true, false); response = await fetch(`${base}/ready`); assert.equal(response.status, 200); assert.deepEqual(await response.json(), { status: 'ready', cache: 'degraded' });
    f.health(false, false); assert.equal((await fetch(`${base}/ready`)).status, 503);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
