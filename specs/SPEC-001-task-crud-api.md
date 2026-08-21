# SPEC-001: Task CRUD API

**Status:** Approved <!-- Approved by Hasnat Ahmed, 2026-08-21, via pipeline approval gate -->
**Requirement source:** poc/README.md sample requirements queue, item #1
**Date:** 2026-08-14

## Open questions & assumptions

<!-- Deliberately first: the approver reads the doubts before the plan. -->
- **Q:** "Complete" a task — is this a dedicated action (e.g. `POST /tasks/:id/complete`) or a generic partial update (`PATCH /tasks/:id` with `{completed: true}`)? The requirement only says "complete."
  **A (assumption):** Implement as a dedicated action endpoint, `POST /tasks/:id/complete`, since the requirement lists "complete" as a distinct capability alongside create/list/delete, not general field editing. A generic update endpoint is out of scope.
- **Q:** Can a task be un-completed (reopened)?
  **A (assumption):** Not required by this spec. Completing an already-completed task is idempotent (returns 200, no error) rather than erroring.
- **Q:** What fields does a task have?
  **A (assumption):** `id` (server-generated string, e.g. UUID), `title` (required, non-empty string, max 200 chars, trimmed), `completed` (boolean, defaults false), `createdAt` (server-generated ISO 8601 timestamp). No description, due date, or owner field — those belong to other queued requirements (#2 due dates) or are unspecified.
- **Q:** Where is data stored?
  **A (assumption):** In-memory store for this POC iteration (no database). Data does not survive process restart. This is explicitly out of scope to change here; a persistence spec would be a separate feature.
- **Q:** What does "meaningful error responses" mean structurally?
  **A (assumption):** JSON body `{"error": {"message": "<human-readable string>"}}` on all 4xx responses, with an appropriate HTTP status code (400 validation, 404 not found). No error-code enum is required for this iteration.
- **Q:** Is authentication in scope?
  **A:** No — API-key auth is queued requirement #3, explicitly separate. This spec assumes unauthenticated access.
- **Q:** Are duplicate titles allowed?
  **A (assumption):** Yes, no uniqueness constraint on `title`.
- **Q:** Can a client supply their own `id` on create?
  **A (assumption):** No — `id` is always server-generated; a client-supplied `id` in the POST body is ignored.

## Problem

The POC app currently only exposes `GET /health`. To exercise the requirement→spec→task→code pipeline end to end, the app needs its first real capability: a JSON API for managing a simple to-do list of tasks (create, list, complete, delete), with input validation and clear error responses so both humans and the QA agent can verify correct behavior.

## Scope

**In:**
- `POST /tasks` — create a task from a validated title.
- `GET /tasks` — list all tasks.
- `POST /tasks/:id/complete` — mark a task completed (idempotent).
- `DELETE /tasks/:id` — delete a task.
- Input validation on create (title required, non-empty, within length limit) with 400 responses.
- 404 responses for actions on a non-existent task id.
- Consistent JSON error response shape across all endpoints.

**Out (explicitly not doing):**
- Authentication/authorization (queued requirement #3).
- Due dates, sorting, overdue logic (queued requirement #2).
- Editing/updating task fields other than completing (no generic `PATCH`).
- Persistent storage (database, file storage) — in-memory only.
- Pagination, filtering, or sorting of `GET /tasks` (returns all tasks, unordered guarantee not required beyond stable insertion order).
- Un-completing a task, bulk operations, multi-user/ownership concerns.

## Acceptance criteria

<!-- Objectively checkable. QA tests these verbatim; planner maps every one to a task.
     Include performance budgets where relevant (e.g. "p95 latency < 200ms at 50 rps on POST /tasks"). -->
1. `POST /tasks` with body `{"title": "Buy milk"}` returns `201` with a JSON body containing `id` (string), `title: "Buy milk"`, `completed: false`, and `createdAt` (ISO 8601 string).
2. `POST /tasks` with missing `title`, empty string `title`, `title` that is not a string, or `title` longer than 200 characters returns `400` with body `{"error": {"message": "<reason>"}}`; no task is created.
3. `POST /tasks` with a malformed JSON body returns `400` with the standard error body.
4. `GET /tasks` on an empty store returns `200` with body `[]`.
5. `GET /tasks` after creating N tasks returns `200` with a JSON array of exactly N task objects, each matching the shape from criterion 1.
6. `POST /tasks/:id/complete` on an existing, incomplete task returns `200` with the task's `completed` field now `true`; the task's `id`, `title`, and `createdAt` are unchanged.
7. `POST /tasks/:id/complete` on an already-completed task returns `200` (idempotent), `completed` remains `true`, no error.
8. `POST /tasks/:id/complete` on a non-existent `id` returns `404` with the standard error body.
9. `DELETE /tasks/:id` on an existing task returns `204` with an empty body; a subsequent `GET /tasks` no longer includes that task.
10. `DELETE /tasks/:id` on a non-existent `id` returns `404` with the standard error body.
11. All error responses (400/404) across all endpoints use the shape `{"error": {"message": string}}` and set `Content-Type: application/json`.
12. Existing `GET /health` behavior is unaffected by these changes.
13. Performance budget: for each endpoint above, p95 latency < 100ms at 20 requests/sec against the in-memory store on POC-scale hardware (single instance, no external I/O).

## Design

<!-- Architect agent fills this section only for design-significant specs; otherwise delete. -->

---
*Target one page, ceiling two. Tasks derived from this spec: `tasks/TASK-001.*`.*
