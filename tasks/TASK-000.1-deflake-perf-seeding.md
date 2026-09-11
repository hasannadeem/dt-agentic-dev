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
`POST /tasks` perf test was left unchanged **at that point** — its loop *is*
the measured operation, so it carried no HTTP-*seeding* risk. It was migrated
later anyway (see the root-cause correction below): the real defect was
per-call server binding, which that loop did share. The rest of `tests/` (`dueDate.test.ts`, `errors.test.ts`,
`health.test.ts`, `taskStore.test.ts`, `taskTitle.test.ts`,
`tasks-overdue.test.ts`) was checked (grep for loop/seeding patterns) and
had no other seeding loops above the ~20-fixture threshold;
`tasks-overdue.test.ts`'s perf test was already using the correct pattern
and served as the reference implementation.

## Root-cause correction (recorded during review, 2026-09-11)

The original diagnosis in the Intent above — socket *exhaustion* from HTTP
seeding — was incomplete, and the first implementation only reduced the
symptom (measured 7/8 clean, down from ~4/5, but still failing).

Adding the in-loop status assertion required by done-criterion 2 exposed the
actual mechanism: a failing run reported `expected 404 to be 201` from a valid
`POST /tasks`. Our app has no code path returning 404 for that request, so the
response did not come from the app under test. `request(app)` starts a **fresh
ephemeral-port server per call**; at loop volume those ports intermittently
collide with other local processes, and the request is answered by whatever
else holds the port. (The TASK-002.2 reviewer saw the same signature from a
different port — a stray `401` — and attributed it to socket pressure.)

Fix: `tests/support/server.ts` exposes `withServer(app, fn)`, which binds one
server for the whole loop and closes it afterwards. All five perf tests now
use it.

Stability, measured on the final branch state rather than an intermediate
commit: **20/20 consecutive clean full-suite runs**, independently re-run by the
code-reviewer agent in a clean worktree. An earlier "10/10" figure in this file
described commit `cc56be3`, which the reviewer measured at 18/20 — that commit
was missing the `tasks.test.ts` migration entirely. Same-machine pre-fix
baselines differed (19/20 reviewer, ~4/5 orchestrator), so the absolute
improvement is not statistically established at this sample size. What is
established: runtime ephemeral-port binds drop ~211 → ~76, and the branch
passes 20/20.

**Remaining surface:** ~70 single-shot `request(app)` call sites still bind per
call, so the same failure signature is possible there at lower probability.
Both failures observed mid-review were in functional tests, not perf loops.
Suite-wide rollout is TASK-000.3.

This is also a concrete argument for done-criterion 2: without the in-loop
status assertion, a response from the wrong server was simply timed and
counted as a pass — the suite was green while measuring nothing.
