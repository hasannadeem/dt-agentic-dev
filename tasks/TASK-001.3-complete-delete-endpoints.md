# TASK-001.3: POST /tasks/:id/complete and DELETE /tasks/:id endpoints

**Spec:** SPEC-001 (specs/SPEC-001-task-crud-api.md)
**Size:** M
**Depends on:** TASK-001.1 (task model, store, validation, error helper)
**Status:** Todo
**Branch:** task/001.3-complete-delete-endpoints

## Intent

Wire `POST /tasks/:id/complete` (idempotent completion) and `DELETE /tasks/:id` into `src/app.ts`, using the store/error helper from TASK-001.1, with full supertest coverage of success and not-found cases.

## Approach

- Mount routes on the existing `express.Express` app from `createApp()` in `src/app.ts` (or a router module imported into it): `POST /tasks/:id/complete`, `DELETE /tasks/:id`.
- `POST /tasks/:id/complete`: call store `complete(id)`; if found (whether or not it was already completed), respond `200` with the updated task; if not found, respond `404` via the shared error helper.
- `DELETE /tasks/:id`: call store `remove(id)`; if found, respond `204` with an empty body; if not found, respond `404` via the shared error helper.
- Do not change `GET /health`.

## Done-criteria

1. `POST /tasks/:id/complete` on an existing, incomplete task returns `200` with `completed: true`, and unchanged `id`, `title`, `createdAt` (SPEC-001 acceptance criterion #6).
2. `POST /tasks/:id/complete` called a second time on the same (now-completed) task returns `200` (idempotent), `completed` remains `true`, no error (acceptance criterion #7).
3. `POST /tasks/:id/complete` on a non-existent id returns `404` with the standard error body (acceptance criterion #8).
4. `DELETE /tasks/:id` on an existing task returns `204` with an empty body, and a subsequent `GET /tasks` no longer includes that task (acceptance criterion #9).
5. `DELETE /tasks/:id` on a non-existent id returns `404` with the standard error body (acceptance criterion #10).
6. All 404 responses from this task's endpoints use shape `{"error": {"message": string}}` and set `Content-Type: application/json` (acceptance criterion #11, the complete/delete portion).
7. `tests/health.test.ts` continues to pass unmodified after adding these routes — `GET /health` still returns `200 {"status":"ok"}` and unknown routes still 404 (acceptance criterion #12, re-verified here since this task also touches `src/app.ts`).
8. A lightweight in-process latency smoke check exists for `POST /tasks/:id/complete` and `DELETE /tasks/:id` (e.g. issue a batch of sequential/concurrent requests against the in-memory store and assert p95 duration < 100ms), documented as a POC-scale smoke check rather than a full load-test harness (acceptance criterion #13, the complete/delete portion).
9. New tests (supertest, in `poc/app/tests/`) exist for each criterion above and pass locally via `npm run test`.
10. `npm run lint` and `npm run typecheck` are clean; `npm run gates` passes.

## Notes / escalations

- Parallel-with-caveat: this task is logically independent of TASK-001.2 (different endpoints, both depend only on TASK-001.1), but both tasks add route registrations to `src/app.ts` (or the same router file). If run in parallel by separate developer agents, expect a merge conflict on that file — the orchestrator should either serialize these two tasks' merges, or have each task add its routes via a distinct router module mounted independently. Do not resolve a merge conflict by dropping the other task's routes.
- Test setup/teardown must ensure `GET /tasks` used in done-criterion #4 only sees tasks created within that test (fresh `createApp()`/store per test, consistent with the existing `tests/health.test.ts` pattern of calling `createApp()` per request) to avoid cross-test pollution given the in-memory store has no reset endpoint.
- If acceptance criterion #13's latency budget cannot be meaningfully verified without added tooling, stop after the standard 2 fix attempts and escalate rather than skip the check silently.
