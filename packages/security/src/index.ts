import ipaddr from 'ipaddr.js';
import { AppError } from '../../errors/src/index.js';
const invalid = (): never => { throw new AppError('INVALID_INPUT'); };
const internalSuffixes = ['localhost', 'local', 'internal', 'lan', 'home', 'localdomain', 'test', 'invalid', 'onion', 'arpa'];
/** Syntactic destination policy only: no DNS lookup or network request occurs. */
export function validateShortenInput(input: unknown): { url: string; expiresAt: Date | null } {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return invalid();
  const row = input as Record<string, unknown>;
  if (Object.keys(row).some(key => !['url', 'expiresAt'].includes(key))) return invalid();
  if (typeof row.url !== 'string' || row.url.length > 2048 || /[\s\x00-\x1f\x7f\\]/u.test(row.url) || /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i.test(row.url) || !/^https?:\/\//i.test(row.url)) return invalid();
  let parsed: URL;
  try { parsed = new URL(row.url); } catch { return invalid(); }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) return invalid();
  const host = parsed.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, '').toLowerCase();
  if (ipaddr.isValid(host)) {
    // Includes loopback, private, link-local, documentation, multicast,
    // unspecified, carrier NAT, IPv4 mapped IPv6, and transition ranges.
    if (ipaddr.parse(host).range() !== 'unicast') return invalid();
  } else {
    const labels = host.split('.');
    if (host.length > 253 || labels.length < 2 || labels.some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label)) || internalSuffixes.some(suffix => host === suffix || host.endsWith(`.${suffix}`))) return invalid();
  }
  const url = parsed.href;
  if (url.length > 2048) return invalid();
  let expiresAt: Date | null = null;
  if (row.expiresAt !== undefined) {
    if (typeof row.expiresAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(row.expiresAt)) return invalid();
    expiresAt = new Date(row.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now() || expiresAt.toISOString() !== (row.expiresAt.includes('.') ? row.expiresAt : row.expiresAt.replace('Z', '.000Z'))) return invalid();
  }
  return { url, expiresAt };
}
export function validateCode(code: unknown): string {
  if (typeof code !== 'string' || !/^[A-Za-z0-9]{8}$/.test(code)) return invalid();
  return code;
}
