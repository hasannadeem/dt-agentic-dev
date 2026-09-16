# SPEC-003: API-Key Authentication

**Status:** Approved
**Requirement source:** poc/README.md sample requirements queue, item #3 — "Add simple API-key authentication; unauthenticated requests are rejected with a proper error."
**Date:** 2026-09-15

## Open questions & assumptions

- **[DECIDE] Q:** When the server starts with no key configured, should protected endpoints fail closed (reject everything) or fail open (allow everything)?
  **Recommended:** Fail closed — every protected endpoint returns `503` with the standard error shape; `GET /health` still returns `200`. Fail-open would silently disable a security feature on a config oversight; crash-at-startup turns the same oversight into a total, undiagnosable outage. `503` makes the misconfiguration visible and recoverable without an outage.
- **[DECIDE] Q:** Does `GET /health` require the API key, or does it stay open?
  **Recommended:** Stays open. It's used by monitoring/uptime tooling that typically can't hold a key, and it exposes no task data — only a liveness flag.
- **[DECIDE] Q:** One shared key for all clients, or per-client keys with individual issuance/rotation/revocation?
  **Recommended:** One shared key, matching "simple API-key authentication" in the raw requirement and the POC's single-tenant scale. Per-client keys are the most likely piece of this to return if the API is ever exposed to multiple real clients — flagged here so it isn't built by accident now.
- **[DECIDE] Q:** Is this feature design-significant enough to require the architect stage before task planning?
  **Recommended:** Yes. `poc/README.md` calls this out explicitly ("Requirement 3 is deliberately security-adjacent to exercise the architect and ... security-auditor paths"). Auth touches every existing endpoint and introduces a new security-sensitive comparison primitive with a failure-mode decision (see fail-closed above) — the kind of cross-cutting, hard-to-reverse choice the architect stage exists for. The planner should not turn this Draft into tasks until the Design section below is filled and the spec is re-reviewed.
- **[ASSUMED] Q:** Where is the valid key configured?
  **A:** A single key read from the `API_KEY` environment variable at server startup, mirroring the existing `PORT` pattern in `server.ts`. Per CLAUDE.md, agents never touch `.env`/secrets — a human sets `API_KEY` in the deployment environment. `createApp()` gains an optional config parameter so tests can inject a key directly, mirroring the existing `store` injection seam already used for perf/seed tests.
- **[ASSUMED] Q:** Which header carries the key?
  **A:** A custom `X-API-Key` header, not `Authorization: Bearer`. `Bearer` implies OAuth2/JWT semantics (scopes, expiry, issuance) this feature doesn't have; `X-API-Key` is the conventional choice for a single static shared secret.
- **[ASSUMED] Q:** 401 vs 403 for missing vs. invalid key?
  **A:** Both return `401`, reusing the existing `{"error":{"message"}}` shape and `Content-Type: application/json` unmodified from SPEC-001/002. There is only one permission tier (valid key or not), so there's no "authenticated but forbidden" case to justify `403`.
- **[ASSUMED] Q:** Does the comparison need to be timing-safe?
  **A:** Yes — a naive `===` comparison leaks the key byte-by-byte via response-time side channels. This follows directly from "the comparison exists at all" once the feature is security-adjacent; the exact primitive is left to the architect/implementation, not re-litigated here.
- **[ASSUMED] Q:** Rate limiting or lockout on repeated invalid-key attempts?
  **A:** Out of scope for this POC-scale spec, consistent with SPEC-001/002's scope discipline. Follow-up only if the API is ever exposed beyond the trusted demo environment.

## Problem

The task API currently has no access control: any client that can reach the server can read, create, complete, or delete any task. This adds a minimal authentication gate — a single shared API key required on every task-related request — with a consistent, well-defined error for anyone who doesn't have it. This is the pipeline's first security-adjacent requirement and is treated accordingly.

## Scope

**In:**
- A single shared API key, configured at server startup, required via header on all `/tasks*` endpoints.
- `GET /health` remains open, unauthenticated.
- Missing or wrong key → `401`, standard error shape, no task data returned or mutated.
- Constant-time key comparison.
- Explicit, defined behavior when no key is configured server-side (fail closed, `503`).

**Out (explicitly not doing):**
- Per-client/multiple keys, key issuance, rotation, or revocation endpoints.
- Any role/permission model beyond "has a valid key or doesn't" (no `403`, no scopes).
- Persistent/hashed key storage — single in-memory comparison against one configured value, POC scale only.
- Rate limiting, lockout, or audit logging of failed auth attempts.
- TLS/HTTPS termination (assumed handled outside this app, e.g. a reverse proxy, if ever deployed).
- Sessions, refresh tokens, expiry, or any OAuth-style flow.

## Acceptance criteria

1. `GET /health` with no `X-API-Key` header returns `200` (unauthenticated access allowed).
2. A request to any of `POST /tasks`, `GET /tasks`, `GET /tasks/overdue`, `POST /tasks/:id/complete`, `DELETE /tasks/:id` with no `X-API-Key` header returns `401`, body `{"error":{"message":"<reason>"}}`, `Content-Type: application/json`; no task is created, returned, completed, or deleted.
3. The same set of requests with `X-API-Key` present but not equal to the configured key returns `401` with the same shape; no task data is returned or mutated.
4. The same set of requests with `X-API-Key` exactly equal to the configured key proceeds to normal SPEC-001/SPEC-002 behavior — status code and response body unaffected by this spec.
5. Key comparison is case-sensitive, exact-match only (no prefix/partial match accepted).
6. The `401` error message never echoes the submitted key value and does not distinguish "key missing" from "key present but wrong" in its wording.
7. Key comparison uses a constant-time primitive, not a short-circuiting equality check — verified by code inspection/unit test asserting the comparison function used, not by wall-clock timing measurement in CI (timing assertions are flaky by nature).
8. When the server starts with no key configured, every request to a protected endpoint returns `503` with the standard error shape; `GET /health` still returns `200`.
9. All existing SPEC-001 and SPEC-002 acceptance criteria continue to pass unmodified when requests include a valid `X-API-Key` header — no regression to bodies, status codes, or ordering.
10. Performance budget: the auth check adds no more than 5ms to p95 latency versus the SPEC-002 baseline, measured on `GET /tasks/overdue` at 20 requests/sec with up to 1,000 tasks in the in-memory store (single instance, POC-scale hardware).

## Design

<!-- Architect stage, 2026-09-16. Design decision record for SPEC-003. -->

### Decision

One Express middleware, mounted on the `/tasks` path prefix **before** `express.json()`. It has two parts: a pure comparison function, and a handler factory that reads the key it is given. The rest of the auth decision (the fail-closed `503`) lives inside the middleware.

**Where the code lives:** a new file, `poc/app/src/auth/apiKey.ts`. It follows the `src/validation/` pattern: a pure function with its own unit test. It exports two functions:

```ts
// Constant-time, exact, case-sensitive. false for undefined/missing input.
export function apiKeyMatches(provided: string | undefined, expected: string): boolean;

// expectedKey undefined => 503 on every request (fail closed).
export function requireApiKey(expectedKey: string | undefined): RequestHandler;
```

**Comparison.** Use `createHash('sha256')` and `timingSafeEqual`, both imported from `'node:crypto'`:
- If `provided` is `undefined`, return `false`.
- Otherwise compute the SHA-256 digests of `provided` and `expected` and return `timingSafeEqual(digestA, digestB)`.
- Why hash first: both digests are always 32 bytes. Without hashing, `timingSafeEqual` would need the length check it throws on, and that check would leak the key's length.
- Compute the expected digest once, when `requireApiKey` is called, not on every request.

**Middleware behavior, in order:**
1. If `expectedKey` is `undefined`, respond `sendError(res, 503, 'authentication is not configured')`.
2. Else if `apiKeyMatches(req.get('X-API-Key'), expectedKey)` is false, respond `sendError(res, 401, 'missing or invalid API key')`. The message is fixed text, the same for missing and wrong keys (AC6).
3. Otherwise call `next()`.

**Wiring:**
- **`app.ts` signature.** Change it to `createApp(store = new TaskStore(), config: AppConfig = {})`, where `AppConfig` is `{ apiKey?: string }`. The existing `createApp(seedStore)` seam keeps working. If `config` is omitted there is no key, so the default is fail-closed.
- **Route order in `app.ts`.** Register `GET /health` first, then `app.use('/tasks', requireApiKey(config.apiKey))`, then `app.use(express.json())`, then the existing routes and error handler, unchanged.
- **`server.ts`.** Read `process.env.API_KEY` and treat an empty string as not configured (`process.env.API_KEY || undefined`). Pass it through `createApp(undefined, { apiKey })`. If no key is configured, print one startup warning with `console.error`. The warning names the `API_KEY` variable and never prints its value.

### Rejected alternatives

- **Middleware attached route by route** (`app.get('/tasks', requireApiKey, handler)` and so on). Every future `/tasks*` route would have to remember to opt in, and forgetting would leave that route open with no error. Mounting on the prefix protects every current and future `/tasks*` route by default. It also uses Express's own path matching, so case and trailing-slash variants are covered the same way the route handlers match them.
- **Global middleware with a `/health` allowlist** (deny everything, allow `/health`). This would also reject unknown routes like `GET /nope` with `401`. The existing `health.test.ts` and `tasks-overdue.test.ts` assert `404` there. It would also go beyond the approved scope, which covers `/tasks*` only.

### Consequences and constraints for the developer

1. **The middleware must stay before `express.json()`.** A request without a key must not have its body parsed. Unauthenticated malformed JSON therefore gets `401`, not `400`. With a valid key, the SPEC-001 #3 `400` behavior is unchanged.
2. **`createApp` must never read `process.env`.** Only `server.ts` reads the environment. This keeps tests sealed off from whatever `API_KEY` happens to be set in CI or on a developer's shell.
3. **The existing test suite will fail until it is updated.** Fail-closed means all 52 existing `createApp()` calls in tests now get `503`. Changes needed:
   - Put a single `TEST_API_KEY` and helpers in `tests/support/`: one builds an app with the key, one sends requests with the header.
   - Existing test files change only their setup lines. Assertions must not be edited, removed, or weakened (AC9). The reviewer should check the diff for exactly that.
   - Unauthenticated and `503` tests must build their app and requests explicitly, not through the helper.
4. **Planner sequencing.**
   - `apiKeyMatches`, `requireApiKey`, and their unit tests can land first as a standalone task, not yet wired into the app.
   - Wiring, the `server.ts` change, and the test-suite migration must ship together in one PR, or the gates go red.
5. **AC7 test.** Use `vi.mock('node:crypto', async (importOriginal) => ({ ...(await importOriginal()), timingSafeEqual: vi.fn(<actual>) }))` and assert the mock was called. This only works if `apiKey.ts` imports from exactly `'node:crypto'`, so keep that import specifier.
6. **AC5 tests must include:**
   - a prefix of the key
   - the key plus a suffix
   - a case-flipped key
   - a same-length wrong key
   - an empty header value
7. **AC8 tests** must cover both `createApp()` with no config and `apiKey: undefined`. The empty-string case is normalized in `server.ts`, so unit-test that normalization too. Pull it into a small exported function if needed for testability.
8. **AC10 performance.** There is deliberately no switch to turn auth off, so a no-auth baseline app can't be built in the same test run. Verify AC10 with two checks:
   - (a) Rerun the existing SPEC-002 #16 overdue performance test with a valid key and confirm p95 is still under 150ms.
   - (b) Time `apiKeyMatches` in isolation over at least 1,000 calls and assert p95 under 5ms.
   - Do not add a test-only bypass flag to `createApp`.
9. **Routes outside `/tasks` are not protected.** Any future spec that adds a top-level path outside `/tasks` must decide its own auth explicitly.

### Security notes (for security-auditor)

- **Empty key.** `API_KEY=""` must behave as not configured (`503`). It must never match an empty or whitespace `X-API-Key` header. This is the most likely fail-open bug.
- **Path-variant bypass.** Confirm the prefix mount cannot be bypassed by path variants. Check each of these without a key and expect `401`:
  - `GET /TASKS`
  - `GET /tasks/`
  - `GET /Tasks/overdue`
  - `POST /tasks/x/complete`
  - `HEAD /tasks`
  - `OPTIONS /tasks`
- **Constant-time comparison.** Verify there is no early return on length and no `===` or `Buffer.equals` on key material. The only early return allowed is for a missing header, which reveals nothing the caller doesn't already know.
- **Key disclosure.** The key value, or the submitted header, must not appear in any response body, error message, or log line. That includes the startup warning.
- **Parsing order.** Unauthenticated requests must not reach `express.json()`, which parses bodies up to 100kb. The ordering in constraint 1 exists for this.
- **No `WWW-Authenticate` header.** `401` is sent without this header, a deliberate small deviation from RFC 9110 §15.5.2, because `X-API-Key` is not a registered auth scheme. Auditor to confirm this is acceptable at POC scale.
- **Header whitespace.** Node strips leading and trailing whitespace from header values. A configured key with surrounding whitespace can therefore never match, and all protected requests get `401`. That fails closed, but operators should set a key of printable ASCII with no surrounding whitespace.
- **Accepted risks, out of scope by spec:** no rate limiting or lockout, no TLS (the key travels in cleartext unless something in front of the app terminates TLS), and the key is held in process memory and the environment.

## Questions for the approver

1. No key configured at startup: fail closed with `503` on protected endpoints (recommended), or some other behavior (fail open / crash at startup)?
2. Should `GET /health` stay unauthenticated, or should it also require the API key?
3. Single shared key for the whole POC (recommended), or per-client keys with issuance/rotation/revocation now?
4. Should this spec route through the architect stage before task planning (recommended: yes), or is it simple enough to go straight to tasks?

---
*Target one page, ceiling two. Tasks derived from this spec: `tasks/TASK-003.*`.*
