import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Database } from '../packages/database/src/index.js';
import { AppError, CollisionError } from '../packages/errors/src/index.js';
import { createLogger } from '../packages/logger/src/index.js';

test('real Database pool: functions, collision, expiry, revocation, concurrency and shutdown', { timeout: 20000 }, async () => {
  const required = (key: string): string => {
    const value = process.env[key];
    assert.ok(value, `${key} is required; integration tests never silently skip`);
    return value;
  };
  const options = {
    host: required('DB_TEST_HOST'), port: Number(process.env.DB_TEST_PORT ?? 5432),
    database: process.env.POSTGRES_DB ?? 'shortener', max: 3,
    connectionTimeoutMillis: 2000, idleTimeoutMillis: 1000, statement_timeout: 5000,
  };
  const logs: string[] = [];
  const logger = createLogger(line => logs.push(line));
  const runtime = new Database({ ...options, user: 'link_runtime', password: required('DB_RUNTIME_PASSWORD') }, logger);
  const maintenance = new Database({ ...options, user: 'link_maintenance', password: required('DB_MAINTENANCE_PASSWORD') }, logger);
  const ids: string[] = [];
  try {
    assert.equal(await runtime.health(), true);
    const input = { shortCode: randomBytes(4).toString('hex'), url: 'https://example.org/private?token=not-for-logs', expiresAt: null };
    const link = await runtime.createLink(input);
    ids.push(link.id);
    assert.equal((await runtime.resolveLink(link.shortCode))?.url, input.url);
    await assert.rejects(runtime.createLink(input), CollisionError);
    await assert.rejects(runtime.disableLink(link.id), (error: unknown) => error instanceof AppError && error.code === 'UNAVAILABLE');
    assert.equal((await maintenance.disableLink(link.id))?.id, link.id);
    assert.equal(await runtime.resolveLink(link.shortCode), null);
    const expiring = await runtime.createLink({ ...input, shortCode: randomBytes(4).toString('hex'), expiresAt: new Date(Date.now() + 300) });
    ids.push(expiring.id);
    await delay(400);
    assert.equal(await runtime.resolveLink(expiring.shortCode), null);
    const race = { ...input, shortCode: randomBytes(4).toString('hex') };
    const outcomes = await Promise.allSettled(Array.from({ length: 12 }, () => runtime.createLink(race)));
    const successes = outcomes.filter(result => result.status === 'fulfilled');
    assert.equal(successes.length, 1);
    for (const outcome of outcomes) {
      if (outcome.status === 'fulfilled') ids.push(outcome.value.id);
      else assert.ok(outcome.reason instanceof CollisionError);
    }
    assert.equal((await maintenance.deleteLink(link.id))?.id, link.id);
    assert.equal(await maintenance.deleteLink(link.id), null);
    assert.equal(logs.some(line => line.includes('not-for-logs')), false);
  } finally {
    try { for (const id of ids) await maintenance.deleteLink(id); }
    finally { await Promise.all([runtime.close(), maintenance.close()]); }
  }
});
