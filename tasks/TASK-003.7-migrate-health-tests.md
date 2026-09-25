# TASK-003.7: Migrate `tests/health.test.ts` + fix unknown-route expectation

**Spec:** SPEC-003 (specs/SPEC-003-api-key-auth.md)
**Size:** S
**Depends on:** TASK-003.3 (auth wiring + `tests/support/app.ts`)
**Status:** Todo
**Branch:** task/003.7-migrate-health-tests (stacked on task/003.3-wire-auth-into-app)

## Intent

Update the 2 `createApp(...)` call sites in `tests/health.test.ts`, add an explicit test that `GET /health` needs no key, and fix the pre-existing "unknown routes return 404" test — deny-by-default now returns `401` for unknown routes without a key, which is intended per the spec's design but breaks that test's current expectation.

## Approach

- Migrate the 2 existing call sites to `createTestApp(...)`.
- Add/confirm a test: `GET /health` with **no** `X-API-Key` header returns `200`.
- Update the existing unknown-route test: either (a) send a valid `X-API-Key` and assert `404` (route truly doesn't exist), and/or (b) add a companion assertion that the same unknown route with **no** key returns `401`, not `404` — per the spec's stated intent that deny-by-default must not reveal which routes exist. Cover both angles so the behavior change is explicit, not silently dropped.

## Done-criteria

1. `GET /health` with no `X-API-Key` header returns `200` (covers SPEC acceptance criterion #1, explicitly, in addition to the wiring-level check in TASK-003.3).
2. Both `createApp(...)` call sites in `tests/health.test.ts` use `createTestApp(...)` where a key is needed for the assertion under test.
3. The "unknown route" test asserts `401` (no key) for an unknown path, and — separately — `404` when a valid key is presented to the same unknown path, documenting the intentional behavior change called out in the spec's Design section (no acceptance-criterion number; a spec-documented constraint, not a numbered AC).
4. `npm run test` passes for this file.
5. `npm run lint` and `npm run typecheck` are clean.

## Notes / escalations

If the unknown-route behavior seems to conflict with any SPEC-001/002 acceptance criterion (it shouldn't — the spec states it doesn't), stop and escalate rather than reinterpreting.
