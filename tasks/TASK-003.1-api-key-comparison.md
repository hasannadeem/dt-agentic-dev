# TASK-003.1: API-key comparison primitive and middleware factory (standalone, unwired)

**Spec:** SPEC-003 (specs/SPEC-003-api-key-auth.md), Design section
**Size:** S
**Depends on:** none — parallelizable
**Status:** Todo
**Branch:** task/003.1-api-key-comparison

## Intent

Add `poc/app/src/auth/apiKey.ts`, exporting a constant-time key-comparison function and a middleware-handler factory, exactly as specified in SPEC-003's Design section. This lands as a standalone, unwired module with its own unit tests — nothing in `app.ts`/`server.ts` changes here (that's TASK-003.2).

## Approach

- New file `poc/app/src/auth/apiKey.ts`, following the `src/validation/` pattern (pure function + colocated unit test), per Design "Where the code lives".
- `apiKeyMatches(provided: string | undefined, expected: string): boolean` — `false` if `provided` is `undefined`; otherwise SHA-256-hash both (`createHash('sha256')`) and compare with `timingSafeEqual`, both from `'node:crypto'` (exact import specifier required — AC7's test mocks it). No `===`, no `Buffer.equals`, no length-based early return other than the missing-header case.
- `requireApiKey(expectedKey: string | undefined): RequestHandler` — computes the expected digest once, at call time, not per-request. In order: if `expectedKey` is `undefined`, `sendError(res, 503, 'authentication is not configured')`; else if `apiKeyMatches(req.get('X-API-Key'), expectedKey)` is false, `sendError(res, 401, 'missing or invalid API key')` (fixed text, identical for missing vs. wrong key); else `next()`. Use `sendError` from `../errors.js`, matching existing route code.
- Unit tests in `poc/app/tests/` (mirroring existing `taskTitle.test.ts`/`dueDate.test.ts` placement), calling `apiKeyMatches`/`requireApiKey` directly — no `createApp()`/HTTP involved.

## Done-criteria

1. `apiKeyMatches` returns `false` when `provided` is `undefined`, and `true`/`false` correctly for equal/unequal strings (covers SPEC acceptance criterion #5, baseline).
2. `apiKeyMatches` tests cover: a prefix of the key, the key plus a suffix, a case-flipped key, a same-length wrong key, and an empty header value — all `false`; the exact key — `true` (covers acceptance criterion #5).
3. A unit test asserts `apiKeyMatches`/`requireApiKey` import `timingSafeEqual` from `node:crypto` and that it is actually invoked during a comparison, via `vi.mock('node:crypto', ...)` per the Design's AC7 guidance — not a wall-clock timing measurement (covers acceptance criterion #7).
4. A test asserts the `401` response body/message from `requireApiKey` is fixed text that never echoes the submitted `X-API-Key` value and is worded identically for "missing header" and "wrong key" (covers acceptance criterion #6).
5. A test asserts `requireApiKey(undefined)` responds `503` with the standard `{"error":{"message"}}` shape for any request, regardless of headers (covers acceptance criterion #8 at the unit level; end-to-end coverage through real endpoints is TASK-003.2).
6. A micro-benchmark test times `apiKeyMatches` in isolation over at least 1,000 calls and asserts p95 under 5ms, documented as the isolated half of AC10's budget (per Design constraint 8) — the other half (in-app p95 regression) is verified in TASK-003.2 (covers acceptance criterion #10, in part).
7. `apiKey.ts` is not imported or wired into `app.ts` or `server.ts` in this task — verified by inspection; wiring is out of scope here.
8. Tests exist for each criterion above and pass locally via `npm run test`.
9. Lint + type-check clean (`npm run lint`, `npm run typecheck`).

## Notes / escalations

- This task intentionally ships unreachable code (no route mounts it yet) — that is expected per the Design's sequencing note ("can land first as a standalone task, not yet wired into the app"), not a gap to fix here.
- If `node:crypto`'s `timingSafeEqual` cannot be mocked the way the Design describes (e.g. Vitest/ESM interop issue), stop after 2 fix attempts and escalate with what was tried, per CLAUDE.md's escalation rule — do not substitute a wall-clock timing assertion.
