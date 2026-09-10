import { createHmac } from 'node:crypto';
import { AppError } from '../../errors/src/index.js';
export interface RateRedisPort { eval(script: string, numberOfKeys: number, ...args: (string | number)[]): Promise<unknown> }
export interface RateLimitConfig { secret: string; windowSeconds: number; createLimit: number; redirectLimit: number; globalLimit: number }
// Both fixed-window counters and their expirations are one Redis transaction.
// Shared hash tag permits this script on Redis Cluster as well.
export const RATE_LIMIT_SCRIPT = `
local retry = 0
for i = 1, 2 do
  local count = redis.call('INCR', KEYS[i])
  local ttl = redis.call('TTL', KEYS[i])
  if count == 1 or ttl < 0 then
    redis.call('EXPIRE', KEYS[i], ARGV[1])
    ttl = tonumber(ARGV[1])
  end
  if count > tonumber(ARGV[i + 1]) then
    retry = math.max(retry, math.max(1, ttl))
  end
end
return retry
`;
export class DistributedRateLimiter {
  constructor(private readonly redis: RateRedisPort, private readonly config: RateLimitConfig) {
    if (config.secret.length < 32 || [config.windowSeconds, config.createLimit, config.redirectLimit, config.globalLimit].some(value => !Number.isSafeInteger(value) || value < 1)) throw new Error('Invalid rate limit configuration');
  }
  async check(ip: string, operation: 'create' | 'redirect'): Promise<void> {
    const token = createHmac('sha256', this.config.secret).update(ip).digest('hex');
    let retry: unknown;
    try {
      retry = await this.redis.eval(RATE_LIMIT_SCRIPT, 2, `rate:{${token}}:global`, `rate:{${token}}:${operation}`, this.config.windowSeconds, this.config.globalLimit, operation === 'create' ? this.config.createLimit : this.config.redirectLimit);
      if (typeof retry !== 'number' || !Number.isSafeInteger(retry) || retry < 0) throw new Error('Invalid rate response');
    } catch {
      if (operation === 'create') throw new AppError('UNAVAILABLE');
      return;
    }
    if (retry > 0) throw new AppError('RATE_LIMITED', retry);
  }
}
