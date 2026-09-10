# Security Policy

Creation accepts a JSON object with `url` and optional `expiresAt`, with no additional fields. Original and normalized URLs are limited to 2,048 characters. Only HTTP/HTTPS with an explicit authority is accepted; credentials, whitespace, control characters, backslashes, and encoded control/backslash forms are rejected. `URL` normalizes scheme, host, default port, and alternate IPv4 forms before network policy is applied. Codes are exactly eight Base62 characters.

`ipaddr.js` accepts only publicly routable unicast addresses. It rejects loopback, private, link-local, multicast, unspecified, CGNAT, documentation, reserved, IPv4-mapped IPv6, and transition ranges. DNS names require at least two valid labels; suffixes `localhost`, `local`, `internal`, `lan`, `home`, `localdomain`, `test`, `invalid`, `onion`, and `arpa` are rejected, including a trailing dot. Dates use UTC ISO format with optional seconds and milliseconds; they must be real future dates without calendar rollover.

This policy is syntactic. It does not resolve DNS or request the destination. It cannot guarantee that a public domain never resolves to a private network, prevent DNS rebinding, or stop later redirects. The API gives the browser a redirect; it is not an HTTP proxy or reputation/phishing checker.

## Distributed limits

Each request creates two Redis keys: a global-per-IP key and an operation-per-IP key. The identifier is HMAC-SHA256 with the shared secret, so the original IP is not stored. Each IP uses a Redis hash tag so the atomic script runs in one slot. Do not log IPs, secrets, or destinations.

One Lua script increments both counters and sets expiration on the first increment. Windows are fixed, start with the first access, and may allow edge bursts. Rejected attempts count toward both quotas but do not renew TTL. If either quota is exceeded, return 429 with `Retry-After` equal to the greatest exceeded TTL, with a minimum of one second. Both instances share Redis and the secret; quotas are not per-process.

Unavailable or invalid Redis returns 503 for creation; redirects continue under the proxy's basic protection. Local counters never replace Redis. Redis backend errors are not exposed to clients. The controller must use the peer IP and trust only the configured proxy, which overwrites `X-Forwarded-For`.

## Verification

`tests/security.test.ts` covers allowed destinations, normalization, alternate IPv4 forms, IPv6, private/reserved ranges, internal domains, credentials, controls, schemes, lengths, invalid dates, codes, HMAC and shared keys, quotas, `Retry-After`, and Redis failure. These tests use a Redis fake; atomicity, expiration, and distribution must also be checked with real Redis in E2E.
