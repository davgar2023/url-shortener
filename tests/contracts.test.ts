import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path: string): string => readFileSync(new URL(path, root), 'utf8');

test('phase 1 defines the required package and deployment boundaries', () => {
  for (const path of ['apps/api/src/modules/links', 'packages/database/src', 'packages/cache/src',
    'packages/security/src', 'packages/rate-limit/src', 'packages/config/src', 'packages/logger/src',
    'database/migrations', 'database/functions', 'database/roles', 'infra/nginx', 'docs', 'tests']) {
    assert.ok(existsSync(fileURLToPath(new URL(path, root))), `Missing ${path}`);
  }
});

test('contract defines HTTP, all database methods, failover and strict cache validation', () => {
  const contract = read('docs/contracts.md');
  for (const token of ['POST /shorten', 'GET /:code', '201', '302', '429', 'Retry-After',
    'createLink', 'resolveLink', 'disableLink', 'deleteLink', 'purgeExpiredLinks', 'health',
    'Base62', 'Database.resolveLink', 'Redis unavailable', 'Gate 1', 'Gate 6', '23505']) {
    assert.ok(contract.includes(token), `Contract omits ${token}`);
  }
});

test('design includes diagrams and separates capacity hypotheses from measurements', () => {
  const design = read('docs/system-design.md');
  for (const token of ['flowchart TD', 'erDiagram', 'SQLite', 'SECURITY DEFINER', '3NF',
    'assumptions, not measurements', '218,340,105,584,896', 'backup', 'Shutdown']) {
    assert.ok(design.includes(token), `Design omits ${token}`);
  }
  assert.equal(62 ** 8, 218_340_105_584_896);
  assert.equal(10 * 86_400 * 30, 25_920_000);
});
