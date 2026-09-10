import { isIP } from 'node:net';
import type { DatabaseOptions } from '../../database/src/database.types.js';
export interface Config {
  database: DatabaseOptions;
  redis: { host: string; port: number; password: string };
  baseUrl: string; port: number; trustProxyIp: string; instanceId: string; rateLimitSecret: string;
  cacheTtlSeconds: number; rateWindowSeconds: number; rateCreateLimit: number; rateRedirectLimit: number; rateGlobalLimit: number;
}
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const fail = (key: string): never => { throw new Error(`Invalid configuration: ${key}`); };
  const required = (key: string, minimum = 1): string => { const value = env[key]; if (!value || value.length < minimum || /[\r\n\0]/.test(value)) return fail(key); return value; };
  const integer = (key: string, fallback: number, min: number, max: number) => { const text = env[key] ?? String(fallback); if (!/^\d+$/.test(text)) return fail(key); const value = Number(text); if (!Number.isSafeInteger(value) || value < min || value > max) return fail(key); return value; };
  const baseUrl = required('BASE_URL'); let parsed: URL;
  try { parsed = new URL(baseUrl); } catch { return fail('BASE_URL'); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') fail('BASE_URL');
  const trustProxyIp = required('TRUST_PROXY_IP'); if (!isIP(trustProxyIp)) fail('TRUST_PROXY_IP');
  const instanceId = required('INSTANCE_ID'); if (!/^[A-Za-z0-9_.-]{1,64}$/.test(instanceId)) fail('INSTANCE_ID');
  return {
    database: { host: required('DB_HOST'), port: integer('DB_PORT', 5432, 1, 65535), database: required('DB_NAME'), user: required('DB_USER'), password: required('DB_PASSWORD', 16), max: integer('DB_POOL_MAX', 10, 1, 100), connectionTimeoutMillis: integer('DB_CONNECT_TIMEOUT_MS', 2000, 100, 30000), idleTimeoutMillis: integer('DB_IDLE_TIMEOUT_MS', 30000, 1000, 300000), statement_timeout: integer('DB_STATEMENT_TIMEOUT_MS', 5000, 100, 30000) },
    redis: { host: required('REDIS_HOST'), port: integer('REDIS_PORT', 6379, 1, 65535), password: required('REDIS_PASSWORD', 16) },
    baseUrl: parsed.origin, port: integer('PORT', 3000, 1, 65535), trustProxyIp, instanceId, rateLimitSecret: required('RATE_LIMIT_SECRET', 32), cacheTtlSeconds: integer('CACHE_TTL_SECONDS', 60, 1, 3600), rateWindowSeconds: integer('RATE_WINDOW_SECONDS', 60, 1, 3600), rateCreateLimit: integer('RATE_CREATE_LIMIT', 10, 1, 100000), rateRedirectLimit: integer('RATE_REDIRECT_LIMIT', 120, 1, 100000), rateGlobalLimit: integer('RATE_GLOBAL_LIMIT', 200, 1, 100000),
  };
}
