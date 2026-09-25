# TASK-003.2: `requireApiKey` Express middleware

**Spec:** SPEC-003 (specs/SPEC-003-api-key-auth.md)
**Size:** S
**Depends on:** TASK-003.1 (pure `apiKey.ts` module)
**Status:** In review
**Branch:** task/003.2-require-api-key-middleware (stacked on task/003.1-apikey-module)

## Intent

Add the Express glue that turns `apiKey.ts`'s pure matcher into deny-by-default middleware: `503` when no key is configured, `401` with one uniform message when the presented key is missing or wrong, `next()` on a match.

## Approach

- New `poc/app/src/middleware/` directory (matching the existing `store/`, `models/`, `validation/` layout), file `requireApiKey.ts`.
- `export interface AuthConfig { apiKey: string | null }` and `export function requireApiKey(config: AuthConfig): RequestHandler`.
- `config.apiKey === null` → `sendError(res, 503, 'api key authentication is not configured')`, return.
- Otherwise build the matcher (via `createKeyMatcher(config.apiKey)`) and check `req.header('X-API-Key')`; no match → `sendError(res, 401, 'missing or invalid api key')` (identical string for both missing and wrong — do not branch the message on which case it is); match → `next()`.
- Reuse the existing `sendError` helper from `src/errors.ts` unmodified, so the `{"error":{"message"}}` shape and `Content-Type` stay as-is.

## Done-criteria

1. Given `{ apiKey: null }`, every request through the middleware receives `503` with the standard `{"error":{"message"}}` shape (covers SPEC acceptance criterion #8).
2. Given a configured key, a request with no `X-API-Key` header receives `401` with message `"missing or invalid api key"` (covers acceptance criterion #2).
3. Given a configured key, a request with `X-API-Key` present but not equal to it receives `401` with the identical message text as criterion #2 above — same wording, no "missing" vs "wrong" distinction (covers acceptance criteria #3 and #6).
4. The `401` response body never contains the submitted `X-API-Key` value in any field (covers acceptance criterion #6).
5. Given a configured key, a request with `X-API-Key` exactly equal to it calls `next()` (no response written by the middleware itself) (supports acceptance criterion #4).
6. Tests (unit-level, invoking the middleware directly with mock `req`/`res`/`next`, per the existing project convention) exist for each criterion above and pass locally via `npm run test`.
7. `npm run lint` and `npm run typecheck` are clean.

## Notes / escalations

- This task does not wire the middleware into `createApp` or change registration order — that is TASK-003.3. Keep this task's tests isolated to the middleware function itself.
