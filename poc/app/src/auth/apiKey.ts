import { createHash, timingSafeEqual } from 'node:crypto';
import type { RequestHandler } from 'express';
import { sendError } from '../errors.js';

/**
 * SHA-256 digest of a UTF-8 string. Used so `timingSafeEqual` always
 * receives two 32-byte buffers, regardless of the input's own length.
 */
function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

/**
 * True only for a value that is entirely whitespace (or empty). Used to
 * treat an unusable configured key the same as "no key configured".
 */
function isBlank(value: string): boolean {
  return value.trim().length === 0;
}

/**
 * True only for a non-empty string with no leading/trailing whitespace.
 * A `provided` value that fails this is rejected before it is ever hashed
 * or compared: AC5 requires exact-match only, and surrounding whitespace
 * on the value we were actually given is never an exact match, whatever
 * upstream header parsing did or didn't strip before it reached us.
 */
function isExactCandidate(value: string): boolean {
  return value.length > 0 && value === value.trim();
}

/**
 * Constant-time comparison of a `provided` value against an
 * already-computed `expectedDigest`. Shared by `apiKeyMatches` (which
 * hashes `expected` itself, for standalone/unit use) and `requireApiKey`
 * (which hashes its configured key once, when the middleware is built, and
 * reuses that digest for every request).
 */
function matchesDigest(provided: string | undefined, expectedDigest: Buffer): boolean {
  if (provided === undefined || !isExactCandidate(provided)) {
    return false;
  }

  return timingSafeEqual(digest(provided), expectedDigest);
}

/**
 * Constant-time, exact, case-sensitive comparison of a caller-supplied API
 * key against the configured key. `false` for a missing (`undefined`),
 * empty, or whitespace-padded `provided` value — these are the only early
 * returns, and none of them reveal anything the caller doesn't already
 * know about what it sent.
 *
 * Both values are SHA-256 hashed before comparison so `timingSafeEqual`
 * always receives two 32-byte buffers: `timingSafeEqual` throws on
 * mismatched lengths, and comparing raw, variable-length strings would leak
 * the configured key's length via that length check. No `===` and no
 * `Buffer.equals` are used on key material, and there is no length-based
 * early return comparing `provided` against `expected` — every candidate
 * provided value reaches `timingSafeEqual`.
 */
export function apiKeyMatches(provided: string | undefined, expected: string): boolean {
  return matchesDigest(provided, digest(expected));
}

/**
 * Builds the `X-API-Key` auth middleware for a single configured key.
 * Fails closed: when `expectedKey` is `undefined`, empty, or
 * whitespace-only (no usable key configured at startup), every request
 * gets `503`, never a silent bypass.
 *
 * The expected key's digest is computed once, here, when the middleware is
 * built — not on every request.
 *
 * In order:
 * 1. No usable configured key -> `503`.
 * 2. Missing or wrong `X-API-Key` header -> `401`, fixed message, identical
 *    wording for "missing" and "wrong" so neither case is distinguishable
 *    from the response.
 * 3. Otherwise -> `next()`.
 *
 * Not yet mounted anywhere — wiring into `app.ts`/`server.ts` is a
 * follow-up task.
 */
export function requireApiKey(expectedKey: string | undefined): RequestHandler {
  const expectedDigest =
    expectedKey !== undefined && !isBlank(expectedKey) ? digest(expectedKey) : undefined;

  return (req, res, next) => {
    if (expectedDigest === undefined) {
      sendError(res, 503, 'authentication is not configured');
      return;
    }

    if (!matchesDigest(req.get('X-API-Key'), expectedDigest)) {
      sendError(res, 401, 'missing or invalid API key');
      return;
    }

    next();
  };
}
