import test from 'node:test';
import assert from 'node:assert/strict';
import { validateShortenInput, validateCode } from '../packages/security/src/index.js';
import { DistributedRateLimiter, RATE_LIMIT_SCRIPT } from '../packages/rate-limit/src/index.js';
import { AppError } from '../packages/errors/src/index.js';
const config = { secret: 'a'.repeat(32), windowSeconds: 60, createLimit: 10, redirectLimit: 120, globalLimit: 200 };
test('normalizes public destinations and validates expiry and code', () => {
  assert.deepEqual(validateShortenInput({ url: 'HTTPS://EXAMPLE.COM:443/a' }), { url: 'https://example.com/a', expiresAt: null });
  assert.equal(validateShortenInput({ url: 'https://8.8.8.8', expiresAt: '2099-01-01T00:00:00Z' }).expiresAt?.toISOString(), '2099-01-01T00:00:00.000Z');
  assert.equal(validateShortenInput({ url: 'https://[2606:4700:4700::1111]' }).url, 'https://[2606:4700:4700::1111]/');
  assert.equal(validateCode('Ab12Cd34'), 'Ab12Cd34');
  for (const code of ['abc', '../admin', 'Ab12Cd34\n', '!!!!!!!!']) assert.throws(() => validateCode(code), AppError);
});
test('rejects private, reserved, encoded, mapped and internal destinations', () => {
  const hosts = ['127.0.0.1', '127.1', '2130706433', '0x7f000001', '0177.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '224.0.0.1', '192.0.2.1', '198.51.100.2', '203.0.113.2', '[::]', '[::1]', '[fc00::1]', '[fe80::1]', '[::ffff:127.0.0.1]', '[::ffff:8.8.8.8]', '[2001:db8::1]', 'localhost', 'localhost.', 'a.localhost', 'metadata.google.internal', 'printer', 'a.local', 'a.home.arpa'];
  for (const host of hosts) assert.throws(() => validateShortenInput({ url: `http://${host}/` }), AppError, host);
});
test('rejects malformed schemas, credentials, whitespace, controls and date rollover', () => {
  for (const url of ['javascript:alert(1)', 'ftp://example.com', 'http:example.com', 'https://user:pass@example.com', 'https://example.com/a b', 'https://example.com/\n', 'https://example.com/\\a', 'https://example.com/%0d%0aLocation:x', 'https://example.com/%5C', 'https://example.com/' + 'a'.repeat(2048)]) assert.throws(() => validateShortenInput({ url }), AppError);
  for (const input of [null, [], {}, { url: 4 }, { url: 'https://example.com', extra: true }]) assert.throws(() => validateShortenInput(input), AppError);
  for (const expiresAt of [null, 1, '2000-01-01T00:00:00Z', '2099-02-30T00:00:00Z', '2099-01-01', 'invalid']) assert.throws(() => validateShortenInput({ url: 'https://example.com', expiresAt }), AppError);
});
test('rate limiter sends only HMAC keys and atomic shared global/route counters', async () => {
  const calls: unknown[][] = [];
  const limiter = new DistributedRateLimiter({ async eval(...args) { calls.push(args); return 0; } }, config);
  await limiter.check('203.0.113.7', 'create'); await limiter.check('203.0.113.7', 'redirect');
  assert.equal(calls[0][0], RATE_LIMIT_SCRIPT); assert.equal(calls[0][1], 2);
  assert.equal(calls[0][2], calls[1][2]); assert.notEqual(calls[0][3], calls[1][3]);
  assert.equal(JSON.stringify(calls).includes('203.0.113.7'), false);
  assert.deepEqual(calls[0].slice(4), [60, 200, 10]);
  assert.deepEqual(calls[1].slice(4), [60, 200, 120]);
});
test('429 preserves Retry-After, while Redis failures only fail open for redirects', async () => {
  const denied = new DistributedRateLimiter({ async eval() { return 42; } }, config);
  await assert.rejects(denied.check('1.2.3.4', 'redirect'), (error: unknown) => error instanceof AppError && error.status === 429 && error.retryAfter === 42);
  for (const evalFn of [async () => { throw new Error('redis secret connection detail'); }, async () => 'bad']) {
    const degraded = new DistributedRateLimiter({ eval: evalFn }, config);
    await degraded.check('1.2.3.4', 'redirect');
    await assert.rejects(degraded.check('1.2.3.4', 'create'), (error: unknown) => error instanceof AppError && error.status === 503 && !error.message.includes('secret'));
  }
});
