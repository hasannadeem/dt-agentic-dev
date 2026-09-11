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

**What changed.** `tests/support/server.ts` exports a single function,
`setupTestServer()`, which registers a `beforeAll`/`afterAll` pair and
returns a `request(app)` function to use in place of supertest's own
`request` for the rest of the file:

```
const request = setupTestServer();
...
const res = await request(createApp()).get('/tasks');
```

Internally it binds one plain `http.Server` in `beforeAll` (not
`app.listen()`), and the returned `request(app)` repoints that
already-listening server at `app` by swapping its `'request'` event
listener (`removeAllListeners` + `on`) before issuing the request through
it — no new `.listen()`, so no new ephemeral port is ever consumed, and
each test still gets its own fresh app/store the same way it always has
(`const app = createApp(); ...; await request(app)...`). `afterAll` closes
the one server. Each of the four test files that issue HTTP requests
(`health.test.ts`, `tasks.test.ts`, `tasks-overdue.test.ts`,
`tasks-complete-delete.test.ts`) needs exactly two lines to opt in — the
import and `const request = setupTestServer();` — so every one of the ~78
call sites in test bodies keeps the exact `request(app)` /
`request(createApp())` shape it already had. The 5 perf loops route
through the same `request(app)` wrapper as every other test (they
previously used a separate, lower-level `testServer.use(app)` +
`baseRequest(testServer.server)` pair against the same server); their
seeding, loop counts, timing, and assertions are unchanged.
`dueDate.test.ts`, `errors.test.ts`, `taskStore.test.ts`, `taskTitle.test.ts`
issue no HTTP requests and were not touched. No file under `poc/app/src/`
is in the diff (two were temporarily mutated and reverted, for the
done-criterion-5 verification recorded below).

**Choice between the Approach's two listed options.** The task's Approach
text above offers two explicit options: "vitest `beforeAll`/`afterAll`" or
"`withServer` wrapping a describe block". Binding one server per file in
`beforeAll`/`afterAll` — covering every describe in the file, including the
perf loops — is the *first* of those two, applied at file scope rather than
per-describe; it's a choice between what the task already offered, not a
deviation from it. `withServer` (the second option, and the pre-existing
helper from TASK-000.1) isn't kept running alongside it, because
done-criterion 2 ("every test file binds at most one server, closed after
the file completes") only holds unconditionally if the first option covers
the *whole* file: wrapping individual describes in `withServer`, or keeping
it just for the perf `it`s, would give a file more than one bind over its
lifetime, each closed at that describe's/test's end rather than the file's.

**Done-criterion 1 — verified by grep.** Every `request(app)` /
`request(createApp())` call site in test bodies (excluding comments):

| File | Call sites |
|---|---|
| `health.test.ts` | 2 |
| `tasks.test.ts` | 31 |
| `tasks-overdue.test.ts` | 30 |
| `tasks-complete-delete.test.ts` | 15 |
| **Total** | **78** |

(78, not ~70 — the task's estimate covered only the non-perf sites, which
were 71; the perf loops now share the same `request(app)` call shape as
everything else instead of a separate one.) All 78 resolve to the
`request` function returned by that file's `setupTestServer()` call, never
to `supertest`'s import directly, so none binds its own server.
`grep -rn "\.listen(" tests/` returns exactly one match, inside the
private `bindTestServer` function that `setupTestServer` calls — the whole
suite has one bind implementation.

**Done-criterion 2 — verified directly.** `grep -rln "setupTestServer()"
tests/*.test.ts` returns exactly the 4 HTTP-issuing files, each calling it
exactly once at file scope (not inside any describe) — one
`beforeAll`/`afterAll` pair per file, covering that file's whole run.

**Done-criterion 3.** Test count unchanged: 100 before this task and 100
now (verified by running the suite before and after). No `it`/`it.each`
removed or skipped. Assertion count increased by 2 (see criterion 5).

**Done-criterion 4.** `tests/support/server.ts`'s doc comment on
`setupTestServer` states every `request()` call site in `tests/` — perf
and functional alike — goes through the server it binds and that a file
binds at most one, and documents the wrapper's real concurrency/ordering
constraints (see the code-review round below) — accurate as of this
change.

**Done-criterion 5.** Added, in `tasks-overdue.test.ts`'s perf test, before
the timed loop:
```
const seedCheck = await request(app).get('/tasks/overdue');
expect(seedCheck.status).toBe(200);
expect(seedCheck.body).toHaveLength(seedCount / 2);
```
mirroring `tasks.test.ts`'s GET /tasks perf test. Verified this closes the
actual gap rather than a guessed one: reproduced reviewer finding 3 (on
TASK-000.1) by temporarily changing `createApp`'s body to
`store = new TaskStore();` (silently ignoring the injected/seeded store —
a targeted, realistic "store-ignoring mutation", as opposed to
`TaskStore.listOverdue` always returning `[]`, which is caught by 11 of the
18 tests and doesn't reproduce "all 18 passed"). On the pre-existing code
(this task's changes stashed), that mutation left all 18 tests in
`tasks-overdue.test.ts` green — confirmed the finding exactly. With this
task's changes applied and the same mutation, 17/18 still pass (functional
tests use `createApp()` with no injected store, so they're unaffected by
this specific mutation) and the perf test now fails at the new assertion:
`expected [] to have a length of 500 but got +0`. Both temporary edits to
`poc/app/src/` were reverted immediately after verification; `git status`
confirms no `src/` file is part of this branch's diff.

**Done-criterion 6.** See the 20-run table under "Code review round" below
— the round-2 refactor touched every test file, so that run is the one
that covers the code currently on this branch. Round 1 (the shape described
in "What changed" before the `setupTestServer()` consolidation) also ran
20/20 clean under the same command.

### Code review round (2026-09-11)

The code-reviewer agent returned APPROVE with three LOW findings on the
round-1 implementation, all addressed on this same branch:

1. **Task-file defect.** The "Design decision" section previously
   justified this task's design choice by quoting "a small helper alongside
   withServer" as the task's own Approach text. That string is not in this
   file — it was from the orchestrator's initial chat instructions to the
   developer agent, not this task file — and the section was titled as a
   "deviation" as a result, when what was built is literally the first of
   the two options the Approach text above already lists. Both are fixed by
   rewriting that section (now "Choice between the Approach's two listed
   options", above) without the false quote; nothing in the code changed
   for this finding.
2. **Preamble duplicated verbatim across all four test files.**
   `tests/support/server.ts` now exports a single `setupTestServer()` (see
   "What changed" above) in place of each file separately declaring
   `let testServer`, its own `beforeAll`/`afterAll`, and a local
   `request()` wrapper. Each file's preamble is now the import plus
   `const request = setupTestServer();`. Behavior is unchanged: same
   one-server-per-file binding, same `request(app)` call shape at every
   call site, still 100/100 tests passing. The perf loops were also
   switched to call `request(app)` like every other test instead of the
   lower-level `testServer.use(app)` + `baseRequest(testServer.server)`
   pair — not required by the finding on its own, but falls out of there
   being one exported entry point now, and removes the last place two
   different patterns existed side by side (directly relevant given this
   code is expected to be copied).
3. **Wrapper's concurrency/ordering constraints were undocumented.** Added
   a "Constraints" section to `setupTestServer`'s JSDoc (the one place this
   helper is now defined) stating: issue and await one request at a time;
   a `Test` built from an earlier `request(app)` call but sent after a
   later `request(otherApp)` call is answered by `otherApp`; and a request
   sent before `request(app)` has been called even once in the file hangs
   to the test timeout rather than erroring (the server starts with no
   `'request'` listener attached). Verified both probe cases from the
   review against the current code: `Promise.all([request(a).get('/x'),
   request(b).get('/x')])` resolves both against `b`; building a request
   from `a`, then calling `request(b)`, then awaiting the first, resolves
   it against `b` too — matching the review's reported results. No current
   call site does either — every call site in the suite already issues and
   awaits one request at a time — so this documents a real trap, not a fix
   to a live bug.

**Optional nit (fixed).** `bindTestServer`'s bind-time `once('error',
reject)` listener previously stayed attached indefinitely, so it could
later fire `reject()` on an already-settled promise — a silent no-op, but
one whose exposure window is now a whole file instead of one call. Fixed by
detaching that specific listener once `'listening'` fires. Detaching it
with nothing in its place would leave the server with *no* `'error'`
listener for the rest of its life, which is worse — Node re-throws
(crashing the process) an `'error'` event with zero listeners — so a
permanent `console.error`-based listener is attached once the bind
succeeds, in its place.

**20 consecutive `npm run gates` runs, round 2** (run from `poc/app`, per
`pipeline.config.json`; the refactor above touched every test file, so this
is the run that covers the code on the branch now):

```
run 1: PASS (Tests  100 passed (100)) [7s]
run 2: PASS (Tests  100 passed (100)) [7s]
run 3: PASS (Tests  100 passed (100)) [7s]
run 4: PASS (Tests  100 passed (100)) [7s]
run 5: PASS (Tests  100 passed (100)) [7s]
run 6: PASS (Tests  100 passed (100)) [7s]
run 7: PASS (Tests  100 passed (100)) [8s]
run 8: PASS (Tests  100 passed (100)) [7s]
run 9: PASS (Tests  100 passed (100)) [7s]
run 10: PASS (Tests  100 passed (100)) [7s]
run 11: PASS (Tests  100 passed (100)) [7s]
run 12: PASS (Tests  100 passed (100)) [7s]
run 13: PASS (Tests  100 passed (100)) [7s]
run 14: PASS (Tests  100 passed (100)) [7s]
run 15: PASS (Tests  100 passed (100)) [7s]
run 16: PASS (Tests  100 passed (100)) [7s]
run 17: PASS (Tests  100 passed (100)) [7s]
run 18: PASS (Tests  100 passed (100)) [7s]
run 19: PASS (Tests  100 passed (100)) [7s]
run 20: PASS (Tests  100 passed (100)) [7s]
TOTAL: 20/20 clean (lint + typecheck + 100/100 tests every run)
```

Round 1 ran the same command 20/20 clean twice (same 100/100 result) against
the pre-refactor shape; not reproduced here since it no longer describes the
code on this branch.

**Deviation from the literal instruction wording (unchanged from round 1):**
asked to "Run `npm run gates` and then run the full suite 20 consecutive
times"; this task file's own done-criterion 6 asks for "20 consecutive
clean `npm run gates` runs, reported individually". Did the more thorough
of the two both rounds — full `npm run gates` (lint + typecheck + tests) 20
times, reported individually above.
