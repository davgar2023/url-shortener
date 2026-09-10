export interface Link { id: string; shortCode: string; url: string; createdAt: Date; expiresAt: Date | null; disabledAt: Date | null }
export interface CreateLinkInput { shortCode: string; url: string; expiresAt: Date | null }
export interface DatabasePort {
  createLink(input: CreateLinkInput): Promise<Link>;
  resolveLink(code: string): Promise<Link | null>;
  disableLink(id: string): Promise<Link | null>;
  deleteLink(id: string): Promise<Link | null>;
  purgeExpiredLinks(batchSize: number): Promise<number>;
  health(): Promise<boolean>;
  close(): Promise<void>;
}
export interface DatabaseOptions { host: string; port: number; database: string; user: string; password: string; max: number; connectionTimeoutMillis: number; idleTimeoutMillis: number; statement_timeout: number }
/** Injection seam for unit tests; no pool is exposed by Database. */
export interface PoolPort { query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>; on(event: 'error', handler: (error: Error) => void): unknown; end(): Promise<void> }
