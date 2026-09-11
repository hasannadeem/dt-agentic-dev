# TASK-000.3: Extend single-server reuse to the whole test suite

**Spec:** none (maintenance — micro-spec below)
**Size:** M
**Depends on:** TASK-000.1 (introduces `tests/support/server.ts`)
**Status:** Todo
**Branch:** task/000.3-suite-wide-server-reuse

## Intent (micro-spec)

**Intent:** TASK-000.1 fixed the five perf loops, cutting runtime ephemeral-port
binds from ~211 to ~76. The remaining ~70 single-shot `request(app)` call sites
still bind a fresh ephemeral-port server per call and remain vulnerable to the
same collision. This is not theoretical: both failures observed during the
TASK-000.1 review were in **functional** tests, not perf loops —
`tasks.test.ts` (`expected 404 to be 201` on a valid POST) and
`tasks-overdue.test.ts` (`expected 401 to be 404`, from an app with no auth).

**Approach:** Bind one server per test file (vitest `beforeAll`/`afterAll`, or
`withServer` wrapping a describe block) and route every `request()` through it.
Prefer the smallest change that removes per-call binding; do not restructure
test intent.

**Test:** 20 consecutive clean full-suite runs, and a count showing per-call
bind sites reduced to zero.

## Done-criteria

1. No test issues `request(app)` / `request(createApp())` against an unbound app.
2. Every test file binds at most one server, closed after the file completes.
3. No test weakened, skipped, or deleted; assertion count is unchanged or higher.
4. `tests/support/server.ts`'s scope caveat is updated or removed once accurate.
5. `tasks-overdue.test.ts`'s perf test asserts its seeded length (reviewer
   finding 3 on TASK-000.1: under a store-ignoring mutation all 18 of its tests
   passed, because an empty `[]` also returns 200).
6. 20 consecutive clean `npm run gates` runs, reported individually.

## Notes / escalations

Raised as finding 1 by the code-reviewer agent on TASK-000.1.
