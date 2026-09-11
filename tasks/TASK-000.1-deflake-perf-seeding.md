# TASK-000.1: De-flake perf test seeding in SPEC-001 test files

**Spec:** none (maintenance fix — per CLAUDE.md spec threshold, a small behavioral change carries its micro-spec here)
**Size:** S
**Depends on:** none
**Status:** Todo
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
