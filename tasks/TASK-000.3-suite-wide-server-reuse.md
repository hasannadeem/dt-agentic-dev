# TASK-000.3: Extend single-server reuse to the whole test suite

**Spec:** none (maintenance — micro-spec below)
**Size:** M
**Depends on:** TASK-000.1 (introduces `tests/support/server.ts`)
**Status:** In review
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

### Implementation record (2026-09-11)

**What changed.** `tests/support/server.ts`'s `withServer(app, fn)` (bind,
run, close — scoped to a single call) is replaced by `bindTestServer()` /
`TestServer`, scoped to a whole file:

```
let testServer: TestServer;
beforeAll(async () => { testServer = await bindTestServer(); });
afterAll(async () => { await testServer.close(); });
```

`TestServer.use(app)` repoints the already-listening server at a new Express
app by swapping its `'request'` event listener (`removeAllListeners` +
`on`) — no new `.listen()`, so no new ephemeral port is ever consumed. Each
of the four test files that issue HTTP requests (`health.test.ts`,
`tasks.test.ts`, `tasks-overdue.test.ts`, `tasks-complete-delete.test.ts`)
now declares this pair once, plus a local `request(app)` wrapper
(`supertest`'s default export is imported as `baseRequest` instead) that
calls `testServer.use(app)` then returns `baseRequest(testServer.server)`.
Because the wrapper has the same name and signature as the thing it
replaces, every one of the ~70 call sites in test bodies is byte-identical
to before — only the ~20-line file preamble changed per file. The 5
already-fixed perf loops (previously each opening/closing their own server
via `withServer`) now reuse the same file-level server via
`testServer.use(app)` + `baseRequest(testServer.server)` directly; their
seeding, loop counts, timing, and assertions are unchanged. `dueDate.test.ts`, `errors.test.ts`,
`taskStore.test.ts`, `taskTitle.test.ts` issue no HTTP requests and were not
touched. No file under `poc/app/src/` was changed in the committed diff
(two were mutated and reverted, for verification — see below).

**Design decision — folding the perf loops into the file-level server.**
The task's Approach text says "a small helper alongside withServer",
which could be read as "keep withServer for the perf loops, add a
separate helper for the rest". I instead moved the perf loops onto the same
per-file server and removed `withServer`. Reason: done-criterion 2 and the
orchestrator's instruction ("each test file binds at most one server,
closed when the file finishes") are literal. A file that kept a second,
independent bind-per-perf-test mechanism running alongside a persistent
file-level server would, at least momentarily, have two servers bound at
once, and would close the perf one at that test's end rather than the
file's. Consolidating makes the count exactly one per file, unconditionally
— verified below. This is a bigger diff than the minimum needed to fix only
the ~70 non-perf sites, but it touches only bind/close plumbing, not any
perf test's seeding, loop, or assertions (see the diff on
`tasks.test.ts`/`tasks-overdue.test.ts`/`tasks-complete-delete.test.ts`: the
only lines that differ inside each perf `it()` are the removal of the
`withServer(app, async (server) => { ... })` wrapper and `server` →
`testServer.server`). Flagging this choice for reviewer visibility in case
the narrower reading was intended.

**Done-criterion 1 — verified by grep.** Precise per-call bind-site count
(`request(app)` / `request(createApp())`, excluding comments and the
wrapper's own signature line):

| File | Before | After |
|---|---|---|
| `health.test.ts` | 2 | 0 |
| `tasks.test.ts` | 28 | 0 |
| `tasks-overdue.test.ts` | 28 | 0 |
| `tasks-complete-delete.test.ts` | 13 | 0 |
| **Total** | **71** | **0** |

(71, not ~70 — the task's estimate was close.) All 71 call sites still exist
verbatim in test bodies; they now resolve to each file's local `request()`
wrapper instead of `supertest`'s import, so none binds its own server.
`grep -rn "\.listen(" tests/` now returns exactly one match, in
`bindTestServer` — the whole suite has one bind implementation, invoked at
most once per file.

**Done-criterion 2 — verified directly.** `grep -rln "bindTestServer()"
tests/*.test.ts` returns exactly the 4 HTTP-issuing files, each with exactly
one `beforeAll`/`afterAll` pair. No file calls it more than once.

**Done-criterion 3.** Test count unchanged: 100 before and after (verified
by running the suite pre- and post-change). No `it`/`it.each` removed or
skipped. Assertion count increased by 2 (see criterion 5).

**Done-criterion 4.** `tests/support/server.ts`'s doc comment is rewritten;
it now states every `request()` call site in `tests/` (perf and functional)
goes through a server bound this way, and that no test file binds more than
one server — both true as of this change.

**Done-criterion 5.** Added, in `tasks-overdue.test.ts`'s perf test, before
the timed loop:
```
testServer.use(app);
const seedCheck = await baseRequest(testServer.server).get('/tasks/overdue');
expect(seedCheck.status).toBe(200);
expect(seedCheck.body).toHaveLength(seedCount / 2);
```
mirroring `tasks.test.ts`'s GET /tasks perf test. Verified this closes the
actual gap rather than a guessed one: reproduced reviewer finding 3 by
temporarily changing `createApp`'s body to `store = new TaskStore();` (i.e.
silently ignoring the injected/seeded store — a targeted, realistic
"store-ignoring mutation", as opposed to `TaskStore.listOverdue` always
returning `[]`, which is caught by 11 of the 18 tests and doesn't reproduce
"all 18 passed"). On the pre-existing code (this task's changes stashed),
that mutation left all 18 tests in `tasks-overdue.test.ts` green — confirmed
the finding exactly. With this task's changes applied and the same
mutation, 17/18 still pass (functional tests use `createApp()` with no
injected store, so they're unaffected by this specific mutation) and the
perf test now fails at the new assertion:
`expected [] to have a length of 500 but got +0`. Both temporary edits to
`poc/app/src/` were reverted immediately after verification; `git status`
confirms no `src/` file is part of this branch's diff.

**Done-criterion 6 — 20 consecutive `npm run gates` runs, reported
individually** (run from `poc/app`, per `pipeline.config.json`):

```
run 1: PASS (Tests  100 passed (100)) [8s]
run 2: PASS (Tests  100 passed (100)) [7s]
run 3: PASS (Tests  100 passed (100)) [7s]
run 4: PASS (Tests  100 passed (100)) [7s]
run 5: PASS (Tests  100 passed (100)) [7s]
run 6: PASS (Tests  100 passed (100)) [7s]
run 7: PASS (Tests  100 passed (100)) [7s]
run 8: PASS (Tests  100 passed (100)) [7s]
run 9: PASS (Tests  100 passed (100)) [8s]
run 10: PASS (Tests  100 passed (100)) [7s]
run 11: PASS (Tests  100 passed (100)) [7s]
run 12: PASS (Tests  100 passed (100)) [8s]
run 13: PASS (Tests  100 passed (100)) [7s]
run 14: PASS (Tests  100 passed (100)) [7s]
run 15: PASS (Tests  100 passed (100)) [7s]
run 16: PASS (Tests  100 passed (100)) [8s]
run 17: PASS (Tests  100 passed (100)) [7s]
run 18: PASS (Tests  100 passed (100)) [7s]
run 19: PASS (Tests  100 passed (100)) [7s]
run 20: PASS (Tests  100 passed (100)) [7s]
TOTAL: 20/20 clean (lint + typecheck + 100/100 tests every run)
```

An earlier, identical 20/20 run preceded the done-criterion-5 verification
detour above; this table is the run against the final committed diff.

**Deviation from the literal instruction wording:** the orchestrator's
message said "Run `npm run gates` and then run the full suite 20 consecutive
times" (two separate steps); this task file's own done-criterion 6 asks for
"20 consecutive clean `npm run gates` runs, reported individually". I did
the more thorough of the two — 20 full `npm run gates` runs (each including
lint, typecheck, and the full test suite), reported individually above —
which satisfies both readings.
