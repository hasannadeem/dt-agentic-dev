# TASK-002.1: Optional dueDate field — model, store, validation, create/list/complete

**Spec:** SPEC-002 (specs/SPEC-002-due-dates-overdue.md)
**Size:** M
**Depends on:** none — foundational for this spec; TASK-002.2 depends on this
**Status:** In review
**Branch:** task/002.1-due-date-field

## Intent

Add an optional `dueDate` field to the `Task` model, store, and validation layer, and thread it through the three existing endpoints that return a task (`POST /tasks`, `GET /tasks`, `POST /tasks/:id/complete`) — with format validation on create and no regression to SPEC-001 behavior. `GET /tasks/overdue` is out of scope here (TASK-002.2).

## Approach

- `src/models/task.ts`: extend `Task` with `dueDate: string | null`.
- `src/validation/` (new module, e.g. `dueDate.ts`, mirroring the shape/style of `taskTitle.ts`): validate a raw, untrusted `dueDate` value from the request body.
  - `undefined`/missing → valid, resolves to `null`.
  - a string that parses as a valid date (per the spec's ISO 8601 UTC convention, e.g. via `Date` parsing) → valid, resolves to the string as given (no reformatting required by the spec).
  - anything else (non-string, empty string, unparseable string, number, etc.) → invalid, with a specific human-readable reason, same pattern as title validation.
  - No "must not be in the past" check — per spec, past dates are allowed at creation.
- `src/store/taskStore.ts`: `create()` accepts an optional `dueDate: string | null` (or a second parameter) and stores it verbatim; defaults to `null` if omitted. `complete()` must leave `dueDate` unchanged. `list()` continues to return full task objects including `dueDate`.
- `src/app.ts`: `POST /tasks` reads `dueDate` from the body, runs it through the new validator; on failure, `400` via the existing `sendError` helper with the specific reason, and no task is created; on success (including "absent" → `null`), passes the resolved value into `store.create()`. `GET /tasks` and `POST /tasks/:id/complete` require no route-shape changes beyond the fact that returned task objects now include `dueDate` (this falls out of the model/store change).

## Done-criteria

1. `Task` type includes `dueDate: string | null` (supports SPEC-002 acceptance criteria #1, #2, #4, #5).
2. `POST /tasks` with a valid ISO 8601 `dueDate` string (e.g. `"2026-09-10T00:00:00.000Z"`) returns `201` with that exact `dueDate` in the body alongside the existing fields (covers SPEC acceptance criterion #1).
3. `POST /tasks` with no `dueDate` in the body returns `201` with `dueDate: null`, and is otherwise identical to SPEC-001 acceptance criterion #1 behavior — no regression (covers acceptance criterion #2).
4. `POST /tasks` with a `dueDate` that is present but not a valid date string (e.g. `"not-a-date"`, a number, an empty string) returns `400` with body `{"error": {"message": "<reason>"}}`, and no task is created — verify via a follow-up `GET /tasks` (covers acceptance criterion #3).
5. `GET /tasks` returns every task with a `dueDate` field (string or `null`) matching what was set at creation, for a mix of tasks created with and without a `dueDate` (covers acceptance criterion #4).
6. `POST /tasks/:id/complete` on a task created with a `dueDate` returns that same unchanged `dueDate` in the response (covers acceptance criterion #5).
7. All SPEC-001 acceptance criteria (1–13) continue to pass unmodified against the updated model/store/validation/routes — no regression to create/list/complete/delete behavior or error shapes (partial coverage of acceptance criterion #15; the `GET /tasks/overdue`-specific regression check is out of scope here).
8. Unit tests (vitest) cover the new `dueDate` validation function directly: missing, valid ISO string, non-string, empty string, unparseable string.
9. Supertest tests (in `poc/app/tests/`) exist for done-criteria #2–6 above and pass locally via `npm run test`.
10. `npm run lint` and `npm run typecheck` are clean; `npm run gates` passes.

## Notes / escalations

- Per the spec's open questions, `dueDate` is create-time only in this spec (no `PATCH`/edit endpoint) — do not add one.
- `GET /tasks/overdue` is intentionally not touched by this task; it is TASK-002.2, which depends on the `dueDate` field landing here first.
