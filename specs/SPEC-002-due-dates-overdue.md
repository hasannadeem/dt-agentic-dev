# SPEC-002: Task Due Dates & Overdue Endpoint

**Status:** Approved <!-- Approved by Hasnat Ahmed, 2026-09-04, via pipeline approval gate -->
**Requirement source:** poc/README.md sample requirements queue, item #2
**Date:** 2026-09-04

## Open questions & assumptions

<!-- Deliberately first: the approver reads the doubts before the plan. -->
- **Q:** What format is `dueDate`?
  **A (assumption):** ISO 8601 UTC timestamp string (same convention as `createdAt`, e.g. `2026-09-10T00:00:00.000Z`), not a bare date. Server does not localize or accept timezone offsets other than what `Date` parsing supports.
- **Q:** Is `dueDate` required on create?
  **A (assumption):** Optional. `POST /tasks` accepts an optional `dueDate` field; omitted → stored as `null`. This keeps SPEC-001's `POST /tasks` backward compatible (no existing client breaks).
- **Q:** Can `dueDate` be set or changed after creation?
  **A (assumption):** No. SPEC-001 has no generic update endpoint (`PATCH`), and this requirement doesn't ask for one. Setting `dueDate` is create-time only. Editing due dates post-creation is explicitly out of scope here.
- **Q:** Does completing a task remove it from the overdue list?
  **A (assumption):** Yes. "Overdue" = `dueDate` is in the past AND `completed === false`. Completing a task excludes it from the overdue endpoint immediately, even if its `dueDate` has passed.
- **Q:** Timezone handling for "overdue" comparison?
  **A (assumption):** Server compares `dueDate` against server clock time in UTC (`Date.now()`). No per-user/client timezone support — POC has no user accounts (auth is a separate queued requirement).
- **Q:** "Sorted by how overdue" — direction and tiebreak?
  **A (assumption):** Ascending by `dueDate` (earliest/oldest due date — i.e., most overdue — first). Ties (identical `dueDate`) broken by `createdAt` ascending (earlier-created task first), matching SPEC-001's stable-order convention.
- **Q:** Dedicated endpoint or a filter on the existing list?
  **A (assumption):** New dedicated endpoint, `GET /tasks/overdue`, since the requirement names it as "an endpoint" distinct from listing all tasks. `GET /tasks` is unchanged in behavior beyond gaining the new field.
- **Q:** Does the overdue response expose a computed "how overdue" value (e.g. days/hours late), or is order the only signal?
  **A (assumption):** Order only. Response items are plain task objects (same shape as `GET /tasks`); no computed `overdueBy` field. Flagging this for approver — if the demo/UI needs a human-readable "N days overdue," that's a follow-up requirement.
- **Q:** Is a `dueDate` in the past at creation time rejected?
  **A (assumption):** No validation against "must be in the future." A task can be created already overdue (e.g. backfilled/import scenarios); only format is validated.
- **Q:** What happens with a malformed `dueDate` (not a string, not parseable as a date)?
  **A (assumption):** `400` with the standard `{"error": {"message": "<reason>"}}` shape, same pattern as title validation; no task is created.

## Problem

Tasks currently have no notion of deadlines, so users have no way to see what's late. This adds an optional due date to tasks and a way to surface what's overdue, ordered so the most overdue items are seen first — the minimum needed to make the task list actionable by urgency.

## Scope

**In:**
- Optional `dueDate` field on task creation (`POST /tasks`).
- `dueDate` included in task representation everywhere a task is returned (`POST /tasks`, `GET /tasks`, `POST /tasks/:id/complete`).
- New endpoint `GET /tasks/overdue`: returns incomplete tasks whose `dueDate` has passed, sorted most-overdue-first.
- Validation: malformed `dueDate` on create is rejected with `400`.

**Out (explicitly not doing):**
- Editing/clearing `dueDate` on an existing task (no `PATCH`/update endpoint).
- Timezone-aware or per-user due dates; recurring due dates; reminders/notifications.
- A human-readable "days/hours overdue" computed field in the response.
- Filtering `GET /tasks` by due date, date ranges, or pagination on either endpoint.
- Rejecting past-dated `dueDate` values at creation time.
- Authentication/authorization (queued requirement #3, unaffected by this spec).

## Acceptance criteria

<!-- Objectively checkable. QA tests these verbatim; planner maps every one to a task.
     Include performance budgets where relevant (e.g. "p95 latency < 200ms at 50 rps on POST /tasks"). -->
1. `POST /tasks` with body `{"title": "Pay rent", "dueDate": "2026-09-10T00:00:00.000Z"}` returns `201` with the task object including `dueDate: "2026-09-10T00:00:00.000Z"`, alongside existing fields (`id`, `title`, `completed: false`, `createdAt`).
2. `POST /tasks` with no `dueDate` field returns `201` with `dueDate: null` in the response; behavior otherwise matches SPEC-001 criterion 1 exactly (no regression).
3. `POST /tasks` with `dueDate` present but not a valid ISO 8601 date string (e.g. `"not-a-date"`, a number, or an empty string) returns `400` with body `{"error": {"message": "<reason>"}}`; no task is created.
4. `GET /tasks` returns every task with a `dueDate` field (string or `null`) consistent with what was set on creation.
5. `POST /tasks/:id/complete` response includes the task's unchanged `dueDate`.
6. `GET /tasks/overdue` on a store with no tasks, or no overdue tasks, returns `200` with body `[]`.
7. `GET /tasks/overdue` excludes tasks with `dueDate: null`.
8. `GET /tasks/overdue` excludes tasks whose `completed` is `true`, even if their `dueDate` is in the past.
9. `GET /tasks/overdue` excludes tasks whose `dueDate` is in the future (not yet due).
10. `GET /tasks/overdue` includes every incomplete task whose `dueDate` is earlier than the current server time.
11. Given three overdue tasks with distinct due dates T1 < T2 < T3 (all before now), `GET /tasks/overdue` returns them in the order [T1, T2, T3] (earliest/most-overdue `dueDate` first).
12. Given two overdue tasks with an identical `dueDate`, `GET /tasks/overdue` orders them by `createdAt` ascending (the one created first appears first).
13. Completing an overdue task via `POST /tasks/:id/complete`, then calling `GET /tasks/overdue` again, no longer includes that task.
14. Each item in `GET /tasks/overdue` has the identical shape as items in `GET /tasks` (`id`, `title`, `completed`, `dueDate`, `createdAt`).
15. All existing SPEC-001 acceptance criteria (1–13) continue to pass unmodified — no regression to create/list/complete/delete behavior or error shapes.
16. Performance budget: `GET /tasks/overdue` p95 latency < 150ms at 20 requests/sec with up to 1,000 tasks in the in-memory store (single instance, no external I/O, POC-scale hardware).

## Design

<!-- Architect agent fills this section only for design-significant specs; otherwise delete. -->

---
*Target one page, ceiling two. Tasks derived from this spec: `tasks/TASK-002.*`.*
