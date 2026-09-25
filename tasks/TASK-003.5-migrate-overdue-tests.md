# TASK-003.5: Migrate `tests/tasks-overdue.test.ts` to authenticated `createTestApp`

**Spec:** SPEC-003 (specs/SPEC-003-api-key-auth.md)
**Size:** M
**Depends on:** TASK-003.3 (auth wiring + `tests/support/app.ts`)
**Status:** Todo
**Branch:** task/003.5-migrate-overdue-tests (stacked on task/003.3-wire-auth-into-app)

## Intent

Update all 18 `createApp(...)` call sites in `tests/tasks-overdue.test.ts` to `createTestApp(...)` with `X-API-Key` attached, including the existing SPEC-002 p95-latency perf-smoke test, so `GET /tasks/overdue` behavior continues to pass unmodified now that the gate is global.

## Approach

- Same mechanical substitution as TASK-003.4: `createApp(...)` → `createTestApp(...)`, `.set('X-API-Key', TEST_API_KEY)` on every request.
- The existing perf-smoke test (seeding up to 1,000 tasks, asserting p95 latency) must also route through the authenticated app — attach the header there too so its baseline measurement reflects real request handling. Do not change its threshold or seeding approach in this task; TASK-003.9 owns the auth-overhead budget check and may build on this file.

## Done-criteria

1. All 18 `createApp(...)` call sites in `tests/tasks-overdue.test.ts` use `createTestApp(...)` with `X-API-Key: TEST_API_KEY` attached to every request, including the perf-smoke test (covers acceptance criterion #4 for the overdue endpoint, and is one of the four files completing acceptance criterion #9).
2. Every existing SPEC-002 assertion in this file (filtering, sort order, tiebreak, field shape, perf threshold) passes unmodified with the key attached.
3. `npm run test` passes for this file.
4. `npm run lint` and `npm run typecheck` are clean.

## Notes / escalations

- TASK-003.9 (performance budget, acceptance criterion #10) is stacked on this branch because it extends this same perf-smoke test — do not restructure the perf test in a way that would conflict with that follow-on task; keep the seeding/measurement approach recognizable.
