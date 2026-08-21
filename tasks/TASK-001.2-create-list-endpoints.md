# TASK-001.2: POST /tasks and GET /tasks endpoints

**Spec:** SPEC-001 (specs/SPEC-001-task-crud-api.md)
**Size:** M
**Depends on:** TASK-001.1 (task model, store, validation, error helper)
**Status:** Todo
**Branch:** task/001.2-create-list-endpoints

## Intent

Wire `POST /tasks` (create, with validation) and `GET /tasks` (list) into `src/app.ts`, using the store/validation/error helper from TASK-001.1, with full supertest coverage of success, validation-failure, and malformed-JSON cases.

## Approach

- Mount routes on the existing `express.Express` app from `createApp()` in `src/app.ts` (or a router module imported into it): `POST /tasks`, `GET /tasks`.
- `POST /tasks`: read `title` from body, run it through the TASK-001.1 validation function; on failure, respond `400` via the shared error helper with the specific reason; on success, call store `create()` and respond `201` with the created task.
- `GET /tasks`: respond `200` with the store's `list()` output (array, possibly empty).
- Malformed JSON body on `POST /tasks` (e.g. `express.json()` parse failure) must be caught and turned into a `400` with the standard error shape rather than an unhandled 500 — add an Express error-handling middleware (or equivalent) for this if `express.json()`'s default behavior doesn't already match the spec's error body shape.
- Do not change `GET /health`.

## Done-criteria

1. `POST /tasks` with `{"title": "Buy milk"}` returns `201` with JSON body containing `id` (string), `title: "Buy milk"`, `completed: false`, `createdAt` (ISO 8601 string) (SPEC-001 acceptance criterion #1).
2. `POST /tasks` with missing `title`, empty-string `title`, non-string `title`, or `title` >200 chars each return `400` with body `{"error": {"message": "<reason>"}}`, and no task is created (verify via a follow-up `GET /tasks`) (acceptance criterion #2).
3. `POST /tasks` with a malformed JSON body returns `400` with the standard error body (not a 500) (acceptance criterion #3).
4. `GET /tasks` on an empty store returns `200` with body `[]` (acceptance criterion #4).
5. `GET /tasks` after creating N tasks (test with N ≥ 2) returns `200` with a JSON array of exactly N task objects, each matching the shape from criterion #1 (acceptance criterion #5).
6. All 400 responses from this task's endpoints use shape `{"error": {"message": string}}` and set `Content-Type: application/json` (acceptance criterion #11, the `POST /tasks` portion).
7. `tests/health.test.ts` continues to pass unmodified after adding these routes — `GET /health` still returns `200 {"status":"ok"}` and unknown routes still 404 (acceptance criterion #12).
8. A lightweight in-process latency smoke check exists for `POST /tasks` and `GET /tasks` (e.g. issue a batch of sequential/concurrent requests against the in-memory store and assert p95 duration < 100ms) — document in the test/comments that this is a POC-scale smoke check, not a full load-test harness, since no dedicated perf-testing tool is present in `poc/app`'s devDependencies (acceptance criterion #13, the create/list portion).
9. New tests (supertest, in `poc/app/tests/`) exist for each criterion above and pass locally via `npm run test`.
10. `npm run lint` and `npm run typecheck` are clean; `npm run gates` passes.

## Notes / escalations

- Parallel-with-caveat: this task is logically independent of TASK-001.3 (different endpoints, both depend only on TASK-001.1), but both tasks add route registrations to `src/app.ts` (or the same router file). If run in parallel by separate developer agents, expect a merge conflict on that file — the orchestrator should either serialize these two tasks' merges, or have each task add its routes via a distinct router module (e.g. one router per file) mounted independently to minimize overlap. Flagging here per CLAUDE.md's "ask, don't silently improvise" — do not resolve a merge conflict by dropping the other task's routes.
- If acceptance criterion #13's latency budget cannot be meaningfully verified without added tooling, stop after the standard 2 fix attempts and escalate per docs/01-research/model-routing-strategy.md rather than skip the check silently.
