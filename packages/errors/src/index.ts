export type ErrorCode = 'INVALID_INPUT' | 'NOT_FOUND' | 'PAYLOAD_TOO_LARGE' | 'RATE_LIMITED' | 'INTERNAL_ERROR' | 'UNAVAILABLE';
const definitions: Record<ErrorCode, [number, string]> = {
  INVALID_INPUT: [400, 'Invalid input'], NOT_FOUND: [404, 'Not found'],
  PAYLOAD_TOO_LARGE: [413, 'Payload too large'], RATE_LIMITED: [429, 'Rate limited'],
  INTERNAL_ERROR: [500, 'Internal error'], UNAVAILABLE: [503, 'Service unavailable'],
};
export class AppError extends Error {
  readonly status: number;
  constructor(readonly code: ErrorCode, readonly retryAfter?: number) {
    super(definitions[code][1]); this.name = 'AppError'; this.status = definitions[code][0];
  }
}
export class CollisionError extends Error {
  constructor() { super('Short code collision'); this.name = 'CollisionError'; }
}
