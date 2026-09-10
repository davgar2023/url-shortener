import { randomInt } from 'node:crypto';
import type { DatabasePort, Link } from '../../../../../packages/database/src/database.types.js';
import type { CachePort } from '../../../../../packages/cache/src/index.js';
import { AppError, CollisionError } from '../../../../../packages/errors/src/index.js';
const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
export function generateShortCode(): string { return Array.from({ length: 8 }, () => alphabet[randomInt(62)]).join(''); }
export class LinksService {
  constructor(private readonly database: DatabasePort, private readonly cache: CachePort, private readonly baseUrl: string, private readonly generateCode: () => string = generateShortCode) {}
  async shorten(input: { url: string; expiresAt: Date | null }): Promise<{ shortCode: string; shortUrl: string }> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const shortCode = this.generateCode();
      if (!/^[A-Za-z0-9]{8}$/.test(shortCode)) throw new AppError('INTERNAL_ERROR');
      try {
        const link = await this.database.createLink({ ...input, shortCode });
        await this.cache.set(link);
        return { shortCode: link.shortCode, shortUrl: `${this.baseUrl}/${link.shortCode}` };
      } catch (error) { if (!(error instanceof CollisionError)) throw error; }
    }
    throw new AppError('UNAVAILABLE');
  }
  async resolve(code: string): Promise<Link> {
    const cached = await this.cache.get(code);
    const link = await this.database.resolveLink(code);
    if (!link || link.disabledAt !== null || (link.expiresAt !== null && link.expiresAt.getTime() <= Date.now())) {
      await this.cache.delete(code); throw new AppError('NOT_FOUND');
    }
    if (!cached || cached.id !== link.id || cached.url !== link.url || cached.expiresAt?.getTime() !== link.expiresAt?.getTime()) await this.cache.set(link);
    return link;
  }
  async disableLink(id: string): Promise<Link | null> { const link = await this.database.disableLink(id); if (link) await this.cache.delete(link.shortCode); return link; }
  async deleteLink(id: string): Promise<Link | null> { const link = await this.database.deleteLink(id); if (link) await this.cache.delete(link.shortCode); return link; }
}
