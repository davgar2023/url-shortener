import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import ts from 'typescript';

const root = fileURLToPath(new URL('../', import.meta.url));
const databasePath = 'packages/database/src/Database.ts';
function violations(path: string, source: string): string[] {
  const errors: string[] = [];
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const authorized = path === databasePath;
  const visit = (node: ts.Node): void => {
    if (ts.isStringLiteralLike(node)) {
      if (['pg', 'pg-pool', 'postgres', 'postgresql-client'].includes(node.text) && !authorized) errors.push('PostgreSQL driver outside Database');
      if (/^\s*(SELECT|INSERT|UPDATE|DELETE|WITH|CREATE|ALTER|DROP|TRUNCATE|GRANT|CALL)\s+\S/i.test(node.text)) {
        if (!authorized || !/^SELECT (?:\* FROM link_api\.(?:create_link|resolve_link|disable_link|delete_link)\([\s\S]*\)|link_api\.(?:health|purge_expired_links)\([\s\S]*\) AS (?:healthy|count))$/.test(node.text)
          || /;|--|\/\*/.test(node.text)) errors.push('Non-API SQL statement');
      }
    }
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'query' && !authorized) errors.push('query outside Database');
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return errors;
}
function sources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sources(path) : /\.[cm]?[jt]s$/.test(path) ? [path] : [];
  });
}
test('backend has TypeScript only and SQL/driver access is confined to Database functions', () => {
  const files = [...sources(join(root, 'apps')), ...sources(join(root, 'packages'))];
  assert.ok(files.length > 6);
  for (const path of files) {
    assert.ok(path.endsWith('.ts'), 'JavaScript application file found');
    assert.deepEqual(violations(relative(root, path), readFileSync(path, 'utf8')), [], relative(root, path));
  }
});
test('architecture guard rejects direct table SQL, drivers, query calls and appended SQL', () => {
  for (const text of ["import pg from 'pg'", "const q='SELECT * FROM link_data.links'", 'pool.query(sql)', "const q=`DELETE FROM link_data.links`"])
    assert.ok(violations('apps/api/src/bad.ts', text).length > 0);
  assert.ok(violations(databasePath, "const q='SELECT * FROM link_data.links'").length > 0);
  assert.ok(violations(databasePath, "const q='SELECT * FROM link_api.resolve_link($1); DELETE FROM link_data.links'").length > 0);
  assert.deepEqual(violations(databasePath, "const q='SELECT * FROM link_api.resolve_link($1::text)'"), []);
});
