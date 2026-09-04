# TASK-001.1: Task model, in-memory store, validation, and shared error helper

**Spec:** SPEC-001 (specs/SPEC-001-task-crud-api.md)
**Size:** S
**Depends on:** none — parallelizable (foundational; TASK-001.2 and TASK-001.3 depend on this)
**Status:** Done
**Branch:** task/001.1-task-model-and-store

## Intent

Build the non-HTTP building blocks the route-level tasks will wire up: the `Task` type, an in-memory store (create/list/complete/remove), a title-validation function, and a shared JSON error-response helper matching the spec's error shape. No Express routes are added in this task — `src/app.ts` is not modified.

## Approach

- `src/models/task.ts` (or similar): `Task` interface — `id: string`, `title: string`, `completed: boolean`, `createdAt: string` (ISO 8601).
- `src/store/taskStore.ts`: in-memory store, e.g. a class or closure exposing:
  - `create(title: string): Task` — generates `id` (e.g. `crypto.randomUUID()`) and `createdAt` server-side; ignores any client-supplied `id`.
  - `list(): Task[]` — returns tasks in stable insertion order.
  - `complete(id: string): Task | undefined` — sets `completed = true` if found (idempotent if already `true`); returns `undefined` if not found. `id`, `title`, `createdAt` unchanged by completion.
  - `remove(id: string): boolean` (or the removed `Task | undefined`) — `false`/`undefined` if not found.
- `src/validation/taskTitle.ts`: a function that validates a raw input and returns either a valid trimmed title or a specific rejection reason for: missing, non-string, empty/whitespace-only, and >200 characters.
- `src/errors.ts` (or similar): a helper, e.g. `sendError(res, status, message)`, that writes `{"error": {"message": message}}` and sets `Content-Type: application/json`.

## Done-criteria

1. `Task` type/interface has exactly `id` (string), `title` (string), `completed` (boolean), `createdAt` (ISO 8601 string) — supports the object shape required by SPEC-001 acceptance criteria #1, #5, #6.
2. Store `create()` server-generates `id` and `createdAt` and ignores any caller-supplied `id`/`createdAt`/`completed` — supports the spec's "id is always server-generated" assumption, underpins acceptance criterion #1.
3. Store `list()` returns `[]` on an empty store and all created tasks (in insertion order) otherwise — underpins acceptance criteria #4, #5.
4. Store `complete(id)` returns the updated task with `completed: true` and unchanged `id`/`title`/`createdAt` for an existing task, is a no-op/idempotent (still returns `completed: true`, no error) if called again, and returns `undefined` for an unknown id — underpins acceptance criteria #6, #7, #8.
5. Store `remove(id)` deletes an existing task (subsequent `list()` excludes it) and reports not-found for an unknown id — underpins acceptance criteria #9, #10.
6. Title validation function rejects: missing title, non-string title, empty/whitespace-only title, and title >200 characters, each with a distinct human-readable reason string; accepts a valid non-empty string ≤200 chars (trimmed) — underpins acceptance criterion #2.
7. Error helper always produces body `{"error": {"message": "<reason>"}}` and sets response header `Content-Type: application/json` — underpins acceptance criterion #11 (used by TASK-001.2 and TASK-001.3).
8. Unit tests (vitest, no HTTP/supertest layer) cover: store create/list/complete (fresh + idempotent + not-found)/remove (found + not-found), and validation (missing/non-string/empty/too-long/valid) — all pass locally via `npm run test`.
9. `npm run lint` and `npm run typecheck` are clean.
10. `src/app.ts` and `tests/health.test.ts` are unmodified by this task (no route wiring here — that is TASK-001.2 / TASK-001.3).

## Notes / escalations

- This task does not itself satisfy any SPEC-001 acceptance criterion end-to-end (those are HTTP-level and are verified via supertest in TASK-001.2 / TASK-001.3); it provides the tested internal API those tasks wire into routes.
- If module/file layout above doesn't fit the eventual `src/` conventions, keep the three concerns (model, store, validation) as separately importable, independently unit-testable modules — that separation is what TASK-001.2/001.3 depend on.
