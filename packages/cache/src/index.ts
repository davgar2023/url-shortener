import { Redis } from 'ioredis';
import type { Link } from '../../database/src/database.types.js';
import type { Logger } from '../../logger/src/index.js';
export interface CachePort { get(code: string): Promise<Link | null>; set(link: Link): Promise<void>; delete(code: string): Promise<void>; health(): Promise<boolean> }
export interface CacheRedisPort { get(key: string): Promise<string | null>; set(key: string, value: string, expiryMode: 'PX', ttl: number): Promise<unknown>; del(key: string): Promise<unknown>; ping(): Promise<string> }
export interface CacheMetrics { hit: number; miss: number; error: number }
/** A process creates one Redis client and shares it between cache and rate limiter. */
export function createRedisClient(options: { host: string; port: number; password: string }, logger: Logger): Redis {
  const client = new Redis({ ...options, enableOfflineQueue: false, maxRetriesPerRequest: 1, connectTimeout: 2000, commandTimeout: 2000, retryStrategy: times => Math.min(times * 100, 2000) });
  client.on('error', () => logger.error('redis.connection_error'));
  return client;
}
function decode(raw: string, code: string): Link | null {
  if (raw.length > 8192) return null;
  const value: unknown = JSON.parse(raw);
  if (typeof value !== 'object' || value === null) return null;
  const row = value as Record<string, unknown>;
  const validDate = (date: unknown): date is string => typeof date === 'string' && Number.isFinite(Date.parse(date)) && new Date(date).toISOString() === date;
  if (typeof row.id !== 'string' || !/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(row.id) || row.shortCode !== code || !/^[A-Za-z0-9]{8}$/.test(code) || typeof row.url !== 'string' || row.url.length > 2048 || !/^https?:\/\//i.test(row.url) || /[\s\x00-\x1f\x7f]/.test(row.url) || !validDate(row.createdAt) || !(row.expiresAt === null || validDate(row.expiresAt)) || row.disabledAt !== null) return null;
  return { id: row.id, shortCode: code, url: row.url, createdAt: new Date(row.createdAt), expiresAt: row.expiresAt === null ? null : new Date(row.expiresAt), disabledAt: null };
}
export class LinkCache implements CachePort {
  readonly #metrics: CacheMetrics = { hit: 0, miss: 0, error: 0 };
  constructor(private readonly redis: CacheRedisPort, private readonly ttlSeconds: number, private readonly logger: Logger, private readonly now: () => number = Date.now) {
    if (!Number.isInteger(ttlSeconds) || ttlSeconds < 1 || ttlSeconds > 3600) throw new Error('Invalid cache TTL');
  }
  get metrics(): Readonly<CacheMetrics> { return { ...this.#metrics }; }
  async get(code: string): Promise<Link | null> {
    try {
      const raw = await this.redis.get(`link:${code}`);
      if (raw === null) { this.#metrics.miss++; return null; }
      const link = decode(raw, code);
      if (!link || (link.expiresAt !== null && link.expiresAt.getTime() <= this.now())) { this.#metrics.miss++; await this.delete(code); return null; }
      this.#metrics.hit++; return link;
    } catch { this.#metrics.error++; this.#metrics.miss++; this.logger.error('cache.read_error'); return null; }
  }
  async set(link: Link): Promise<void> {
    const ttl = Math.floor(Math.min(this.ttlSeconds * 1000, link.expiresAt ? link.expiresAt.getTime() - this.now() : Infinity));
    if (link.disabledAt !== null || !Number.isFinite(ttl) || ttl <= 0) return;
    try { await this.redis.set(`link:${link.shortCode}`, JSON.stringify(link), 'PX', ttl); }
    catch { this.#metrics.error++; this.logger.error('cache.write_error'); }
  }
  async delete(code: string): Promise<void> { try { await this.redis.del(`link:${code}`); } catch { this.#metrics.error++; this.logger.error('cache.delete_error'); } }
  async health(): Promise<boolean> { try { return await this.redis.ping() === 'PONG'; } catch { return false; } }
}
