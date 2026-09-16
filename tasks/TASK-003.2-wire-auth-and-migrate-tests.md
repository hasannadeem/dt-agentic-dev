# TASK-003.2: Wire API-key auth into the app, read `API_KEY` at startup, migrate the test suite

**Spec:** SPEC-003 (specs/SPEC-003-api-key-auth.md), Design section
**Size:** L
**Depends on:** TASK-003.1 (apiKeyMatches / requireApiKey and their unit tests)
**Status:** Todo
**Branch:** task/003.2-wire-auth-and-migrate-tests (stacked on task/003.1-api-key-comparison)

## Intent

Mount `requireApiKey` on the `/tasks` prefix, change `createApp`'s signature to accept an `AppConfig`, wire `server.ts` to read `process.env.API_KEY`, and migrate the entire existing test suite to the new fail-closed default — all in one PR, per the Design's explicit sequencing constraint ("Wiring, the `server.ts` change, and the test-suite migration must ship together in one PR, or the gates go red").

## Approach

- **`app.ts`:** change signature to `createApp(store = new TaskStore(), config: AppConfig = {})` with `AppConfig = { apiKey?: string }`. Register `GET /health` first, then `app.use('/tasks', requireApiKey(config.apiKey))`, then `app.use(express.json())`, then the existing routes/error handler, unchanged — this order is load-bearing (constraint 1: unauthenticated requests must not reach body parsing).
- **`server.ts`:** read `process.env.API_KEY || undefined` (empty string normalizes to not-configured — pull this into a small exported function per Design constraint 7 so it's unit-testable). Pass through `createApp(undefined, { apiKey })`. If no key configured, `console.error` one startup warning naming `API_KEY` and never printing its value. `createApp` itself must never read `process.env` (Design constraint 2).
- **Test migration (`poc/app/tests/support/`):** add a `TEST_API_KEY` constant and helpers — one to build an app with the key configured, one to send requests with the `X-API-Key` header set. Update every existing test file's setup lines only (not assertions) to use these helpers, per Design constraint 3. Unauthenticated/`503` tests build their app and requests explicitly, without the helper.
- New auth-specific integration tests (supertest, real `createApp()` + routes) for the criteria below.

## Done-criteria

1. `GET /health` with no `X-API-Key` header returns `200` (covers acceptance criterion #1).
2. Each of `POST /tasks`, `GET /tasks`, `GET /tasks/overdue`, `POST /tasks/:id/complete`, `DELETE /tasks/:id` with no `X-API-Key` header returns `401`, body `{"error":{"message":"<reason>"}}`, `Content-Type: application/json`, and causes no task creation/mutation/return — verified against store state (covers acceptance criterion #2).
3. The same set of requests with an `X-API-Key` present but not equal to the configured key returns `401` with the same shape and no task data returned or mutated (covers acceptance criterion #3).
4. The same set of requests with `X-API-Key` exactly equal to the configured key proceeds to normal SPEC-001/SPEC-002 behavior, status code and body unaffected by this feature (covers acceptance criterion #4).
5. With no key configured (`createApp()` default, and explicit `apiKey: undefined`), every request to a protected endpoint returns `503` with the standard error shape, while `GET /health` still returns `200`; a `server.ts`-level unit test also covers the `API_KEY=""` normalization to "not configured" (covers acceptance criterion #8).
6. The full existing SPEC-001 and SPEC-002 test suites pass unmodified (assertions untouched, only setup lines changed to inject a valid key) — confirmed by diff review showing no assertion changes (covers acceptance criterion #9).
7. The path-variant checks from the Design's security notes are exercised without a key and return `401`, not `200`/`404`-bypassing-auth: `GET /TASKS`, `GET /tasks/`, `GET /Tasks/overdue`, `POST /tasks/x/complete`, `HEAD /tasks`, `OPTIONS /tasks` (covers acceptance criterion #2/#3 robustness, per Design security notes).
8. Malformed JSON with no `X-API-Key` header returns `401`, not `400` (proves the middleware runs before `express.json()`; a malformed-JSON request with a valid key still returns SPEC-001's `400`) (covers Design constraint 1, supporting acceptance criteria #2 and #4).
9. The SPEC-002 #16-equivalent overdue perf smoke test is rerun with a valid key attached and still asserts p95 < 150ms, documented as the in-app half of the AC10 budget (the isolated `apiKeyMatches` half is covered in TASK-003.1) (covers acceptance criterion #10, remainder).
10. `createApp` contains no test-only auth-bypass flag (verified by inspection of the diff) (covers Design constraint 8's explicit prohibition).
11. Tests exist for each criterion above and pass locally via `npm run test`.
12. Lint + type-check clean; `npm run gates` passes in full (covers all of the above collectively, including the no-regression requirement of acceptance criterion #9).

## Notes / escalations

- Depends on TASK-003.1 landing first; branch stacks on `task/003.1-api-key-comparison`, consistent with how `002.2` stacked on `002.1` in this repo's history.
- Per the Design, this task cannot be split further across separate PRs/branches: the fail-closed default breaks all ~52 existing `createApp()` call sites in tests simultaneously, so wiring and the test migration are only ever green together.
- If any existing test's assertions would need to change (not just its setup) to pass after this migration, stop and escalate rather than weaken the assertion — that would silently reduce SPEC-001/002 coverage, which AC9 forbids.
- The security-notes items in the Design (empty-key handling, no key/header disclosure in logs or responses, no `WWW-Authenticate` header, header-whitespace behavior) are implemented here as specified; final sign-off on those is the security-auditor stage's responsibility, not this task's.
