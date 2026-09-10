import pg from 'pg';
import { AppError, CollisionError } from '../../errors/src/index.js';
import type { Logger } from '../../logger/src/index.js';
import type { CreateLinkInput, DatabaseOptions, DatabasePort, Link, PoolPort } from './database.types.js';
export class Database implements DatabasePort {
  readonly #pool: PoolPort;
  constructor(options: DatabaseOptions, logger: Logger, poolFactory: (options: DatabaseOptions) => PoolPort = options => new pg.Pool(options)) {
    this.#pool = poolFactory(options);
    this.#pool.on('error', () => logger.error('database.pool_error'));
  }
  async #execute(text: string, values: unknown[] = []): Promise<Record<string, unknown>[]> {
    try { return (await this.#pool.query(text, values)).rows; }
    catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') throw new CollisionError();
      throw new AppError('UNAVAILABLE');
    }
  }
  private map(row: Record<string, unknown>): Link {
    return { id: String(row.id), shortCode: String(row.short_code), url: String(row.url), createdAt: new Date(row.created_at as string | Date), expiresAt: row.expires_at == null ? null : new Date(row.expires_at as string | Date), disabledAt: row.disabled_at == null ? null : new Date(row.disabled_at as string | Date) };
  }
  async createLink(input: CreateLinkInput): Promise<Link> {
    const [row] = await this.#execute('SELECT * FROM link_api.create_link($1::text, $2::text, $3::timestamptz)', [input.shortCode, input.url, input.expiresAt]);
    if (!row) throw new AppError('UNAVAILABLE');
    return this.map(row);
  }
  async resolveLink(code: string): Promise<Link | null> { const [row] = await this.#execute('SELECT * FROM link_api.resolve_link($1::text)', [code]); return row ? this.map(row) : null; }
  async disableLink(id: string): Promise<Link | null> { const [row] = await this.#execute('SELECT * FROM link_api.disable_link($1::uuid)', [id]); return row ? this.map(row) : null; }
  async deleteLink(id: string): Promise<Link | null> { const [row] = await this.#execute('SELECT * FROM link_api.delete_link($1::uuid)', [id]); return row ? this.map(row) : null; }
  async purgeExpiredLinks(batchSize: number): Promise<number> {
    if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 10000) throw new AppError('INVALID_INPUT');
    const [row] = await this.#execute('SELECT link_api.purge_expired_links($1::integer) AS count', [batchSize]); return Number(row.count);
  }
  async health(): Promise<boolean> { try { const [row] = await this.#execute('SELECT link_api.health() AS healthy'); return row?.healthy === true; } catch { return false; } }
  async close(): Promise<void> { try { await this.#pool.end(); } catch { throw new AppError('UNAVAILABLE'); } }
}
