# TASK-003.9: Auth overhead performance budget check (AC10)

**Spec:** SPEC-003 (specs/SPEC-003-api-key-auth.md)
**Size:** S
**Depends on:** TASK-003.5 (migrated `tests/tasks-overdue.test.ts`, including its perf-smoke test)
**Status:** Todo
**Branch:** task/003.9-auth-perf-budget (stacked on task/003.5-migrate-overdue-tests)

## Intent

Extend the existing `GET /tasks/overdue` perf-smoke test (seeded to 1,000 tasks, ~20 req/s, from TASK-002.2/SPEC-002) with an explicit assertion that the auth gate adds no more than 5ms to p95 latency versus the SPEC-002 baseline threshold — a POC-scale smoke check, not a timing side-channel measurement (that's TASK-003.1's job, by code inspection).

## Approach

- Build on the perf-smoke test already migrated in `tests/tasks-overdue.test.ts` (TASK-003.5): it now runs authenticated by construction (global gate). Add/adjust the assertion so the measured p95 is checked against the existing SPEC-002 threshold plus a documented 5ms allowance, with a comment explaining the two numbers (baseline threshold vs. auth budget) so a future reader doesn't mistake the combined number for the original SPEC-002 budget.
- If meaningfully isolating "auth overhead" from "baseline latency" in a single measurement proves unreliable at POC scale (noisy, no per-request breakdown available), document that limitation in the test and in this task's Notes, and escalate per the standard 2-fix-attempt rule rather than asserting something the test can't actually demonstrate.

## Done-criteria

1. A test asserts p95 latency for `GET /tasks/overdue` (authenticated, 1,000 seeded tasks, ~20 req/s) does not exceed the SPEC-002 baseline threshold plus 5ms, with the two components documented in a comment (covers SPEC acceptance criterion #10).
2. The test is clearly labeled as a POC-scale smoke check, consistent with the existing SPEC-002 perf-smoke-test pattern and CI-flakiness caveat used elsewhere in this suite.
3. `npm run test` passes for this file, including the extended perf assertion.
4. `npm run lint` and `npm run typecheck` are clean.

## Notes / escalations

If a clean before/after (no-auth vs. auth) comparison isn't achievable without deeper harness changes (out of scope here), stop after 2 fix attempts and escalate with what was tried, rather than shipping an assertion that doesn't actually verify the 5ms budget.
