# TASK-003.3: Wire auth gate into `createApp`/`server.ts` + test support

**Spec:** SPEC-003 (specs/SPEC-003-api-key-auth.md)
**Size:** M
**Depends on:** TASK-003.2 (`requireApiKey` middleware)
**Status:** Todo
**Branch:** task/003.3-wire-auth-into-app (stacked on task/003.2-require-api-key-middleware)

## Intent

Register the auth gate in `createApp` in the load-bearing order the Design section specifies — `/health` → gate → `express.json()` → routes → error handler — with a fail-closed default, wire `server.ts` to read `API_KEY` from the environment, and add the shared test-support helper the migration tasks depend on.

## Approach

- `src/app.ts`: change signature to `createApp(store: TaskStore = new TaskStore(), config: AuthConfig = { apiKey: null })`. Register, in exactly this order: (1) `app.get('/health', ...)`, (2) `app.use(requireApiKey(config))` — global, not path-mounted, (3) `app.use(express.json())`, (4) the existing task routes, (5) the existing body-parse error handler. Add a comment on the ordering, in the style of the existing `/tasks/overdue` ordering comment.
- `src/server.ts`: pass `{ apiKey: normalizeConfiguredKey(process.env.API_KEY) }` into `createApp`. `app.ts` itself stays free of `process.env` reads.
- New `poc/app/tests/support/app.ts` exporting `TEST_API_KEY` (a fixed test constant) and `createTestApp(store?: TaskStore)`, which calls `createApp(store, { apiKey: TEST_API_KEY })` — the helper the four migration tasks (TASK-003.4–003.7) will import.
- `poc/README.md`: document the `API_KEY` environment variable (what it does, that it's required for protected endpoints, fail-closed `503` behavior when unset) — do not create or edit any `.env*` file.

## Done-criteria

1. `createApp()` called with no arguments (or `{ apiKey: null }`) fails closed: any `/tasks*` request returns `503`; `GET /health` still returns `200` (covers SPEC acceptance criterion #8's default).
2. `GET /health` returns `200` with no `X-API-Key` header regardless of configured key, because it is registered before the gate (covers acceptance criterion #1).
3. With a configured key and `express.json()` registered after the gate, an unauthenticated `POST /tasks` with a malformed JSON body still returns `401` (from the gate), not `400` (from body-parse failure) — the body is never parsed for a keyless request (supports acceptance criterion #2 and the spec's stated ordering rationale).
4. `server.ts` builds its `AuthConfig` via `normalizeConfiguredKey(process.env.API_KEY)`, so `API_KEY=""` or a whitespace-only value at process start results in the fail-closed `503` path, not a valid-empty-key match (covers acceptance criterion #8's empty/whitespace case).
5. `poc/app/tests/support/app.ts` exists, exporting `TEST_API_KEY` and `createTestApp(store?)`, and is usable by other test files without modification.
6. `poc/README.md` documents the `API_KEY` environment variable; no `.env*` file is created or edited.
7. Tests exist for done-criteria #1–4 above (new, small-scope tests in this task's own branch — not the full 51-call-site migration, which is out of scope here) and pass locally via `npm run test`.
8. `npm run lint` and `npm run typecheck` are clean.

## Notes / escalations

- This task does **not** migrate the 51 existing `createApp(...)` call sites in `tests/tasks.test.ts`, `tests/tasks-overdue.test.ts`, `tests/tasks-complete-delete.test.ts`, or `tests/health.test.ts` — after this branch merges, those files' existing tests will fail (missing key → `401`/`503` instead of their expected SPEC-001/002 responses) until TASK-003.4–003.7 land. This is expected and intentional stacking, not a regression to fix here.
- `tests/health.test.ts`'s existing "unknown routes return 404" test will start failing once the gate is global (deny-by-default now returns `401` for unknown routes without a key) — flagged for TASK-003.7, not fixed in this task.
