import { Router, json, type RequestHandler } from 'express';
import { AppError } from '../../../../../packages/errors/src/index.js';
import { LinksController } from './links.controller.js';
import type { LinksService } from './links.service.js';
export interface RateLimiterPort { check(ip: string, operation: 'create' | 'redirect'): Promise<void> }
export function linksRoutes(service: LinksService, limiter: RateLimiterPort): Router {
  const router = Router(); const controller = new LinksController(service);
  const rate = (operation: 'create' | 'redirect'): RequestHandler => async (request, _response, next) => { await limiter.check(request.ip ?? request.socket.remoteAddress ?? 'unknown', operation); next(); };
  router.post('/shorten', rate('create'), json({ limit: 4096, strict: true }), (request, _response, next) => { if (!request.is('application/json')) throw new AppError('INVALID_INPUT'); next(); }, controller.shorten);
  router.get('/:code', rate('redirect'), controller.resolve);
  return router;
}
