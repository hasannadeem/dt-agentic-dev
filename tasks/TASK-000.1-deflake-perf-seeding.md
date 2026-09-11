# TASK-000.1: De-flake perf test seeding in SPEC-001 test files

**Spec:** none (maintenance fix — per CLAUDE.md spec threshold, a small behavioral change carries its micro-spec here)
**Size:** S
**Depends on:** none
**Status:** In review
**Branch:** task/000.1-deflake-perf-seeding

## Intent (micro-spec)

**Intent:** The full test suite fails intermittently (measured: 1 failure in 5 consecutive runs, ~20%) with socket hang-ups. Root cause identified in the TASK-002.2 review: the perf smoke tests in `poc/app/tests/tasks-complete-delete.test.ts` seed their fixtures by issuing hundreds of HTTP requests through supertest, and each `request(app)` call starts a fresh ephemeral server — under vitest's parallel file execution this exhausts local sockets. A red CI run is unacceptable generally and specifically risky before a stakeholder demo.

**Approach:** Apply the pattern already proven in `poc/app/tests/tasks-overdue.test.ts`: build a `TaskStore` directly, seed it in-process, pass it to `createApp(store)` (the injection seam added in TASK-002.2), and keep only the measured requests going through supertest. Do not change any production code — this is test-infrastructure only.

**Test:** The suite must pass 5 consecutive full `npm run gates` runs with zero failures, and the perf assertions must still measure real HTTP request latency (not in-process calls).

## Done-criteria

1. `tests/tasks-complete-delete.test.ts` perf tests seed via a directly-constructed `TaskStore` passed to `createApp(store)`; no seeding loop issues HTTP requests.
2. Each perf test still measures latency of real supertest HTTP requests and still asserts the response status inside the timing loop (pattern established in TASK-002.2 review).
3. Any other test file that seeds more than ~20 fixtures via HTTP is migrated to the same pattern (audit `tests/` and report what was found).
4. No production source file under `poc/app/src/` is modified.
5. Existing assertions and test intent are preserved — no test is weakened, skipped, or deleted to achieve stability.
6. `npm run gates` passes 5 consecutive times (report all 5 results).

## Notes / escalations

Identified by the code-reviewer agent during the TASK-002.2 review, which flagged it as pre-existing and out of scope for that task and recommended a follow-up. This is that follow-up.

**Audit finding (done-criterion 3):** in addition to the two perf tests in
`tests/tasks-complete-delete.test.ts` named in the intent text above, the
audit found a third offender: `tests/tasks.test.ts`'s
`p95 latency for GET /tasks is under 100ms ...` perf test also seeded 30
tasks via a sequential HTTP loop (`await request(app).post('/tasks')...`)
before its timed loop. This was migrated to the same in-process
`TaskStore` + `createApp(store)` pattern. `tests/tasks.test.ts`'s
`POST /tasks` perf test was left unchanged — its loop *is* the measured
operation, not a seeding step, so there is no HTTP-seeding flakiness risk
there. The rest of `tests/` (`dueDate.test.ts`, `errors.test.ts`,
`health.test.ts`, `taskStore.test.ts`, `taskTitle.test.ts`,
`tasks-overdue.test.ts`) was checked (grep for loop/seeding patterns) and
had no other seeding loops above the ~20-fixture threshold;
`tasks-overdue.test.ts`'s perf test was already using the correct pattern
and served as the reference implementation.
