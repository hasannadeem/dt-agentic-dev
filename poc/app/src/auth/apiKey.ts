import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { sendError } from '../errors.js';

/**
 * Constant-time, exact, case-sensitive comparison of a caller-supplied API
 * key against the configured key. `false` for a missing (`undefined`)
 * `provided` value — this is the only early return, and it reveals nothing
 * the caller doesn't already know (it didn't send a header).
 *
 * Both values are SHA-256 hashed before comparison so `timingSafeEqual`
 * always receives two 32-byte buffers: `timingSafeEqual` throws on
 * mismatched lengths, and comparing raw, variable-length strings would leak
 * the configured key's length via that length check. No `===` and no
 * `Buffer.equals` are used on key material.
 */
export function apiKeyMatches(provided: string | undefined, expected: string): boolean {
  if (provided === undefined) {
    return false;
  }

  const providedDigest = createHash('sha256').update(provided).digest();
  const expectedDigest = createHash('sha256').update(expected).digest();
  return timingSafeEqual(providedDigest, expectedDigest);
}

/**
 * Builds the `X-API-Key` auth middleware for a single configured key.
 * Fails closed: when `expectedKey` is `undefined` (no key configured at
 * startup), every request gets `503`, never a silent bypass.
 *
 * In order:
 * 1. No configured key -> `503`.
 * 2. Missing or wrong `X-API-Key` header -> `401`, fixed message, identical
 *    wording for "missing" and "wrong" so neither case is distinguishable
 *    from the response.
 * 3. Otherwise -> `next()`.
 *
 * Not yet mounted anywhere — wiring into `app.ts`/`server.ts` is a
 * follow-up task.
 */
export function requireApiKey(expectedKey: string | undefined): RequestHandler {
  return (req, res, next) => {
    if (expectedKey === undefined) {
      sendError(res, 503, 'authentication is not configured');
      return;
    }

    if (!apiKeyMatches(req.get('X-API-Key'), expectedKey)) {
      sendError(res, 401, 'missing or invalid API key');
      return;
    }

    next();
  };
}
