import express, { type ErrorRequestHandler } from 'express';
import type { DatabasePort } from '../../../packages/database/src/database.types.js';
import type { CachePort } from '../../../packages/cache/src/index.js';
import type { Config } from '../../../packages/config/src/index.js';
import type { Logger } from '../../../packages/logger/src/index.js';
import { AppError } from '../../../packages/errors/src/index.js';
import { LinksService } from './modules/links/links.service.js';
import { linksRoutes, type RateLimiterPort } from './modules/links/links.routes.js';
export interface AppDependencies { database: DatabasePort; cache: CachePort; limiter: RateLimiterPort; config: Pick<Config, 'baseUrl' | 'trustProxyIp' | 'instanceId'>; logger: Logger }
export function createApp({ database, cache, limiter, config, logger }: AppDependencies) {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', (ip: string) => ip === config.trustProxyIp || ip === `::ffff:${config.trustProxyIp}`);
  app.use((_request, response, next) => { response.set({ 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'", 'Cache-Control': 'no-store', 'X-Instance-Id': config.instanceId }); next(); });
  app.get('/health', (_request, response) => { response.json({ status: 'ok' }); });
  app.get('/ready', async (_request, response) => { const [postgres, redis] = await Promise.all([database.health(), cache.health()]); response.status(postgres ? 200 : 503).json({ status: postgres ? 'ready' : 'unavailable', cache: redis ? 'available' : 'degraded' }); });
  app.use(linksRoutes(new LinksService(database, cache, config.baseUrl), limiter));
  app.use((_request, _response, next) => next(new AppError('NOT_FOUND')));
  const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    const type = typeof error === 'object' && error !== null && 'type' in error ? error.type : undefined;
    const safe = error instanceof AppError ? error : type === 'entity.too.large' ? new AppError('PAYLOAD_TOO_LARGE') : type === 'entity.parse.failed' || error instanceof URIError ? new AppError('INVALID_INPUT') : new AppError('INTERNAL_ERROR');
    if (safe.status >= 500) logger.error('http.request_error', { status: safe.status, instanceId: config.instanceId });
    if (safe.code === 'RATE_LIMITED') response.set('Retry-After', String(safe.retryAfter ?? 1));
    response.status(safe.status).json({ error: { code: safe.code, message: safe.message } });
  };
  app.use(errors); return app;
}
