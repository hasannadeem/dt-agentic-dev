import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { createKeyMatcher, normalizeConfiguredKey } from '../auth/apiKey.js';
import { sendError } from '../errors.js';

/**
 * Auth configuration for {@link requireApiKey}. `apiKey` is the configured
 * shared secret, or `null` when none is configured.
 */
export interface AuthConfig {
  apiKey: string | null;
}

/**
 * Deny-by-default Express middleware gating every request behind a single
 * shared API key, per SPEC-003.
 *
 * `config.apiKey` is re-run through `normalizeConfiguredKey` here — not just
 * trusted as already-normalized — so that `''`/whitespace-only ever reaching
 * this middleware (e.g. a future caller that skips `server.ts`'s own
 * normalization) is treated as "not configured" rather than as a key an
 * empty `X-API-Key` header could match. This is deliberate defense in depth:
 * `createKeyMatcher('')` alone would match an empty presented key, which
 * would be an authentication bypass.
 *
 * - No key configured (`null`, `''`, or whitespace-only) → every request
 *   gets `503` (fail closed), standard error shape.
 * - Key configured but `X-API-Key` missing or not an exact, case-sensitive
 *   match → `401` with one fixed message, identical wording for both cases
 *   so the response never reveals which one happened.
 * - Exact match → `next()`; the middleware writes no response itself.
 *
 * The key digest (via `createKeyMatcher`) is computed once per middleware
 * instance, not per request, matching SPEC-003's performance budget (AC10).
 *
 * Not wired into `createApp` by this module — see TASK-003.3 for
 * registration order (must run before `express.json()`).
 */
export function requireApiKey(config: AuthConfig): RequestHandler {
  const normalizedKey = normalizeConfiguredKey(config.apiKey ?? undefined);
  const matches = normalizedKey === null ? null : createKeyMatcher(normalizedKey);

  return function requireApiKeyMiddleware(req: Request, res: Response, next: NextFunction): void {
    if (matches === null) {
      sendError(res, 503, 'api key authentication is not configured');
      return;
    }

    if (!matches(req.header('X-API-Key'))) {
      sendError(res, 401, 'missing or invalid api key');
      return;
    }

    next();
  };
}
