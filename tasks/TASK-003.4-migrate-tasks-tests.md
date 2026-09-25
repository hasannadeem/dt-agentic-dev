# TASK-003.4: Migrate `tests/tasks.test.ts` to authenticated `createTestApp`

**Spec:** SPEC-003 (specs/SPEC-003-api-key-auth.md)
**Size:** M
**Depends on:** TASK-003.3 (auth wiring + `tests/support/app.ts`)
**Status:** Todo
**Branch:** task/003.4-migrate-tasks-tests (stacked on task/003.3-wire-auth-into-app)

## Intent

Update all 20 `createApp(...)` call sites in `tests/tasks.test.ts` to `createTestApp(...)` and attach `.set('X-API-Key', TEST_API_KEY)` to every request, so SPEC-001's `POST /tasks` and `GET /tasks` behavior continues to pass unmodified now that the gate is global.

## Approach

- Import `createTestApp`, `TEST_API_KEY` from `../tests/support/app.js` (or relative path as used elsewhere in the suite).
- Replace every `createApp(...)` with `createTestApp(...)`; add `.set('X-API-Key', TEST_API_KEY)` on every request built via supertest in this file.
- Do not change any assertion about status codes, bodies, or ordering — SPEC-001 behavior itself is unaffected by this spec (acceptance criterion #4/#9); only the request construction changes.
- Respect the existing sequential-request constraint in `tests/support/server.ts` — do not introduce `Promise.all`/concurrent requests.

## Done-criteria

1. All 20 `createApp(...)` call sites in `tests/tasks.test.ts` use `createTestApp(...)` with `X-API-Key: TEST_API_KEY` attached to every request (covers acceptance criterion #4 for the create/list endpoints, and is one of the four files completing acceptance criterion #9).
2. Every existing SPEC-001 assertion in this file (status codes, bodies, validation-error messages, ordering) passes unmodified with the key attached — no assertion text changed to accommodate auth.
3. `npm run test` passes for this file with no other test files' behavior affected.
4. `npm run lint` and `npm run typecheck` are clean.

## Notes / escalations

- Purely mechanical migration — if any existing assertion in this file turns out to depend on unauthenticated behavior in a way the spec didn't anticipate, stop and escalate rather than editing the assertion to paper over it.
