import type { Request, Response } from 'express';
import { validateCode, validateShortenInput } from '../../../../../packages/security/src/index.js';
import type { LinksService } from './links.service.js';
export class LinksController {
  constructor(private readonly service: LinksService) {}
  shorten = async (request: Request, response: Response): Promise<void> => { response.status(201).json(await this.service.shorten(validateShortenInput(request.body))); };
  resolve = async (request: Request, response: Response): Promise<void> => {
    const link = await this.service.resolve(validateCode(typeof request.params.code === 'string' ? request.params.code : ''));
    response.status(302).set('Location', link.url).set('Cache-Control', 'no-store').end();
  };
}
