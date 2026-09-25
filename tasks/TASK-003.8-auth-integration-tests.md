# TASK-003.8: `tests/auth.test.ts` — cross-endpoint auth behavior matrix

**Spec:** SPEC-003 (specs/SPEC-003-api-key-auth.md)
**Size:** M
**Depends on:** TASK-003.3 (auth wiring + `tests/support/app.ts`)
**Status:** Todo
**Branch:** task/003.8-auth-integration-tests (stacked on task/003.3-wire-auth-into-app)

## Intent

Add a new, dedicated `tests/auth.test.ts` that exercises the full missing/wrong/valid-key matrix across every protected endpoint plus the unconfigured-server case, end-to-end through `createTestApp`/`createApp` — the comprehensive black-box coverage the per-file migration tasks (TASK-003.4–003.7) don't individually provide.

## Approach

- New file, not touching any of the four existing test files (no merge conflicts with TASK-003.4–003.7; this task can run in parallel with them).
- For each of `POST /tasks`, `GET /tasks`, `GET /tasks/overdue`, `POST /tasks/:id/complete`, `DELETE /tasks/:id`: one test with no `X-API-Key` header (expect `401`, standard shape, no task data affected), one with a wrong key (expect identical `401` body/message as the missing case), one with the correct key (expect normal SPEC-001/002 status/body, unaffected by auth).
- One block using an app built with `{ apiKey: null }` (unconfigured): every protected endpoint returns `503`, standard shape; `GET /health` still `200`.
- Assert the `401` response body never contains the wrong key's value, and that the missing-key and wrong-key response bodies are textually identical.
- Respect the sequential-request constraint in `tests/support/server.ts` — no concurrent requests.

## Done-criteria

1. For every protected endpoint, a request with no `X-API-Key` returns `401`, standard `{"error":{"message"}}` shape, `Content-Type: application/json`, and causes no task creation/mutation/return (covers SPEC acceptance criterion #2).
2. For every protected endpoint, a request with a wrong `X-API-Key` returns `401` with the same shape and causes no task creation/mutation/return (covers acceptance criterion #3).
3. For every protected endpoint, a request with the correct `X-API-Key` proceeds to normal SPEC-001/SPEC-002 status/body (covers acceptance criterion #4).
4. The missing-key and wrong-key `401` response bodies are asserted textually identical, and neither contains the submitted key value (covers acceptance criterion #6).
5. With an app built with `{ apiKey: null }`, every protected endpoint returns `503` with the standard error shape, and `GET /health` still returns `200` (covers acceptance criterion #8, end-to-end).
6. `npm run test` passes for this new file.
7. `npm run lint` and `npm run typecheck` are clean.

## Notes / escalations

This task provides the cross-cutting matrix; it does not replace the per-endpoint SPEC-001/002 regression coverage that already lives in the migrated files (TASK-003.4–003.7), which together complete acceptance criterion #9.
