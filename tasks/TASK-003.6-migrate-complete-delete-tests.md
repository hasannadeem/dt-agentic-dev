# TASK-003.6: Migrate `tests/tasks-complete-delete.test.ts` to authenticated `createTestApp`

**Spec:** SPEC-003 (specs/SPEC-003-api-key-auth.md)
**Size:** S
**Depends on:** TASK-003.3 (auth wiring + `tests/support/app.ts`)
**Status:** Todo
**Branch:** task/003.6-migrate-complete-delete-tests (stacked on task/003.3-wire-auth-into-app)

## Intent

Update all 11 `createApp(...)` call sites in `tests/tasks-complete-delete.test.ts` to `createTestApp(...)` with `X-API-Key` attached, so `POST /tasks/:id/complete` and `DELETE /tasks/:id` behavior continues to pass unmodified now that the gate is global.

## Approach

Same mechanical substitution as TASK-003.4: `createApp(...)` → `createTestApp(...)`, `.set('X-API-Key', TEST_API_KEY)` on every request. No assertion changes.

## Done-criteria

1. All 11 `createApp(...)` call sites in `tests/tasks-complete-delete.test.ts` use `createTestApp(...)` with `X-API-Key: TEST_API_KEY` attached to every request (covers acceptance criterion #4 for complete/delete, and is one of the four files completing acceptance criterion #9).
2. Every existing SPEC-001/SPEC-002 assertion in this file passes unmodified with the key attached.
3. `npm run test` passes for this file.
4. `npm run lint` and `npm run typecheck` are clean.

## Notes / escalations

Purely mechanical — escalate rather than edit assertions if any existing test appears to rely on unauthenticated behavior.
