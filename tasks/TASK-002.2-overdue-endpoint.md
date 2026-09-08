# TASK-002.2: GET /tasks/overdue endpoint — filter, sort, tiebreak

**Spec:** SPEC-002 (specs/SPEC-002-due-dates-overdue.md)
**Size:** M
**Depends on:** TASK-002.1 (dueDate field on Task model/store/validation/routes)
**Status:** Done
**Branch:** task/002.2-overdue-endpoint (stacked on task/002.1-due-date-field)

## Intent

Add `GET /tasks/overdue`, returning incomplete tasks whose `dueDate` has passed (server clock, UTC), sorted earliest-`dueDate`-first with `createdAt`-ascending tiebreak, plus a POC-scale latency smoke check.

## Approach

- `src/app.ts` (or a store method, e.g. `TaskStore.listOverdue()`, called from the route — either is acceptable): compute `now = Date.now()` once per request; filter `store.list()` to tasks where `completed === false` and `dueDate !== null` and `Date.parse(dueDate) < now`; sort ascending by parsed `dueDate`, with ties broken by `createdAt` ascending (matching SPEC-001's stable-order convention).
- Response: `200` with a JSON array of task objects, identical shape to `GET /tasks` items (`id`, `title`, `completed`, `dueDate`, `createdAt`) — no computed "how overdue" field, per spec.
- No pagination, no filtering by date range — out of scope per spec.

## Done-criteria

1. `GET /tasks/overdue` on an empty store returns `200` with body `[]` (covers SPEC acceptance criterion #6).
2. `GET /tasks/overdue` on a store with tasks but none overdue (e.g. only future-dated or null-`dueDate` tasks) returns `200` with body `[]` (covers acceptance criterion #6).
3. A task created with `dueDate: null` is excluded from `GET /tasks/overdue` even though it is incomplete (covers acceptance criterion #7).
4. A task with a past `dueDate` but `completed: true` is excluded from `GET /tasks/overdue` (covers acceptance criterion #8).
5. A task with a future `dueDate` is excluded from `GET /tasks/overdue` (covers acceptance criterion #9).
6. Every incomplete task whose `dueDate` is earlier than current server time is included in the response (covers acceptance criterion #10).
7. Given three overdue tasks with distinct due dates T1 < T2 < T3 (all before now), `GET /tasks/overdue` returns them in order `[T1, T2, T3]` (covers acceptance criterion #11).
8. Given two overdue tasks with an identical `dueDate`, `GET /tasks/overdue` orders them by `createdAt` ascending — the one created first appears first (covers acceptance criterion #12).
9. Completing a previously-overdue task via `POST /tasks/:id/complete`, then calling `GET /tasks/overdue` again, no longer includes that task (covers acceptance criterion #13).
10. Each item returned by `GET /tasks/overdue` has the identical field shape to items from `GET /tasks` (`id`, `title`, `completed`, `dueDate`, `createdAt`), verified by comparing a returned overdue item against the same task's representation from `GET /tasks` (covers acceptance criterion #14).
11. A lightweight in-process latency smoke check exists for `GET /tasks/overdue` with up to 1,000 tasks seeded in the store, asserting p95 latency < 150ms at a sustained rate consistent with 20 requests/sec — documented in the test as a POC-scale smoke check, not a full load-test harness, consistent with the existing SPEC-001 perf-smoke-test pattern in `poc/app/tests/` (covers acceptance criterion #16). If this cannot be meaningfully verified without added tooling, stop after 2 fix attempts and escalate rather than skip it.
12. All SPEC-001 acceptance criteria (1–13) and TASK-002.1's done-criteria continue to pass unmodified — full regression check with `GET /tasks/overdue` added (completes coverage of acceptance criterion #15).
13. Tests (vitest + supertest, in `poc/app/tests/`) exist for done-criteria #1–11 above and pass locally via `npm run test`.
14. `npm run lint` and `npm run typecheck` are clean; `npm run gates` passes.

## Notes / escalations

- Branches off `task/002.1-due-date-field` (stacked), not off `main`, per its dependency — consistent with how TASK-001.2/001.3 branched off TASK-001.1 in this repo's history.
- If TASK-002.1 exposed `dueDate` handling in a way that makes computing "overdue" ambiguous (e.g. unclear whether `Date.parse` behavior matches the assumed ISO 8601 UTC convention for edge-case strings), stop and escalate rather than silently reinterpret the spec's open-question assumptions.
