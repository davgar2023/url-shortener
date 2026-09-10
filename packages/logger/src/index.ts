export interface Logger { info(event: string, metadata?: SafeMetadata): void; error(event: string, metadata?: SafeMetadata): void }
export interface SafeMetadata { instanceId?: string; operation?: string; durationMs?: number; status?: number; count?: number }
// Only this allowlist is serialized, even if callers pass extra runtime properties.
export function createLogger(write: (line: string) => void = line => process.stdout.write(line + '\n')): Logger {
  const log = (level: string, event: string, metadata: SafeMetadata = {}) => {
    const safe: Record<string, unknown> = {};
    for (const key of ['instanceId', 'operation', 'durationMs', 'status', 'count'] as const) {
      const value = metadata[key];
      if (typeof value === 'number' && Number.isFinite(value)) safe[key] = value;
      else if (typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value)) safe[key] = value;
    }
    write(JSON.stringify({ time: new Date().toISOString(), level, event: /^[a-z0-9_.-]{1,80}$/.test(event) ? event : 'invalid_event', ...safe }));
  };
  return { info: (event, meta) => log('info', event, meta), error: (event, meta) => log('error', event, meta) };
}
