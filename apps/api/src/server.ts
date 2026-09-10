import { pathToFileURL } from 'node:url';
import { createApp } from './app.js';
import { Database } from '../../../packages/database/src/Database.js';
import { LinkCache, createRedisClient } from '../../../packages/cache/src/index.js';
import { loadConfig } from '../../../packages/config/src/index.js';
import { createLogger } from '../../../packages/logger/src/index.js';
import { DistributedRateLimiter } from '../../../packages/rate-limit/src/index.js';
export function startServer() {
  const config = loadConfig(); const logger = createLogger();
  const database = new Database(config.database, logger);
  const redis = createRedisClient(config.redis, logger);
  const cache = new LinkCache(redis, config.cacheTtlSeconds, logger);
  const limiter = new DistributedRateLimiter(redis, { secret: config.rateLimitSecret, windowSeconds: config.rateWindowSeconds, createLimit: config.rateCreateLimit, redirectLimit: config.rateRedirectLimit, globalLimit: config.rateGlobalLimit });
  const server = createApp({ database, cache, limiter, config, logger }).listen(config.port, '0.0.0.0', () => logger.info('server.started', { instanceId: config.instanceId }));
  server.requestTimeout = 15000; server.headersTimeout = 10000; server.keepAliveTimeout = 5000;
  let stopping = false;
  const shutdown = () => {
    if (stopping) return; stopping = true;
    logger.info('server.stopping', { instanceId: config.instanceId });
    const deadline = setTimeout(() => { server.closeAllConnections(); redis.disconnect(); process.exit(1); }, 10000); deadline.unref();
    server.close(() => {
      void Promise.allSettled([database.close(), redis.quit()]).then(results => {
        clearTimeout(deadline); process.exitCode = results.some(result => result.status === 'rejected') ? 1 : 0;
        redis.disconnect(); process.off('SIGTERM', shutdown); process.off('SIGINT', shutdown);
      });
    });
    server.closeIdleConnections();
  };
  process.on('SIGTERM', shutdown); process.on('SIGINT', shutdown);
  server.on('error', () => { logger.error('server.listen_error'); shutdown(); });
  return { server, shutdown };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { startServer(); } catch { createLogger().error('server.configuration_error'); process.exitCode = 1; }
}
