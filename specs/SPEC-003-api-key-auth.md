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

### Decision

Two new modules plus a wiring change in `app.ts`/`server.ts`. No new dependencies — `node:crypto` covers everything.

**1. `poc/app/src/auth/apiKey.ts` — pure, separately unit-tested (mirrors `src/validation/*`).**

```ts
export function normalizeConfiguredKey(raw: string | undefined): string | null;
export function createKeyMatcher(configuredKey: string): (presented: string | undefined) => boolean;
```

- `normalizeConfiguredKey` trims; `undefined`, `''`, or whitespace-only → `null` (meaning "not configured").
- `createKeyMatcher` computes `createHash('sha256')` of the configured key **once**, at app construction, and returns a closure that compares `sha256(presented ?? '')` against it with `timingSafeEqual`. Comparing fixed-width 32-byte digests (rather than raw key bytes) is what makes this both constant-time *and* length-non-leaking: `timingSafeEqual` throws `RangeError` on unequal-length buffers, so a raw-bytes comparison would have to branch on length first and thereby leak it. No `===` fallback after the digest match — SHA-256 collision is not a POC threat and a second comparison only adds a way to get it wrong.

**2. `poc/app/src/middleware/requireApiKey.ts` — Express glue (new `middleware/` dir, matching the existing `store/`, `models/`, `validation/` layout).**

```ts
export interface AuthConfig { apiKey: string | null }
export function requireApiKey(config: AuthConfig): RequestHandler;
```

- `config.apiKey === null` → `sendError(res, 503, 'api key authentication is not configured')`.
- No match → `sendError(res, 401, 'missing or invalid api key')` — one constant string for both the missing and wrong cases (AC6).
- Match → `next()`.
- Reuses the existing `sendError` helper, so the `{"error":{"message"}}` shape and `Content-Type` are unchanged from SPEC-001/002 by construction.

**3. Wiring in `createApp` — registration order is the load-bearing part.**

`createApp(store: TaskStore = new TaskStore(), config: AuthConfig = { apiKey: null })`, registering in exactly this order:

1. `app.get('/health', ...)` — before the gate, so it stays open (AC1).
2. `app.use(requireApiKey(config))` — **global deny-by-default**, not path-mounted on `/tasks`.
3. `app.use(express.json())` — **after** the gate.
4. Task routes, then the existing body-parse error handler last.

Auth sits before `express.json()` so an unauthenticated request is rejected without parsing an untrusted body: no CPU spent on anonymous payloads, and a malformed-JSON body can't preempt the `401` with a `400` (AC2 requires `401` for *any* keyless request to `POST /tasks`).

The default `{ apiKey: null }` means an app built with no config fails closed (AC8) rather than being accidentally open.

**4. `server.ts`** passes `{ apiKey: normalizeConfiguredKey(process.env.API_KEY) }`. `app.ts` stays free of `process.env`, preserving today's split where only `server.ts` reads the environment (the `PORT` pattern).

**5. Tests.** New `poc/app/tests/support/app.ts` exporting `TEST_API_KEY` and `createTestApp(store?)`; new `tests/auth.test.ts` (AC1–4, 6, 8) and `tests/apiKey.test.ts` (AC5, 7 — asserts the constant-time primitive by inspection, no wall-clock timing).

### Rejected alternatives

1. **Path-mounted gate, `app.use('/tasks', requireApiKey(config))`.** Smaller diff and it leaves the existing unknown-route test alone, but it is allow-by-default: any future route registered outside the `/tasks` prefix is silently public, and nothing fails to tell you. For a security gate the correct default is deny, and the public allowlist is currently one line (`/health`).
2. **Plain `===`, or hashing the key at rest with bcrypt/argon2.** `===` short-circuits on the first differing byte and directly violates AC7. Password-hashing a static shared secret is the wrong tool at the wrong layer: the spec explicitly excludes persistent/hashed key storage, and it would add a dependency plus deliberate per-request cost against the 5ms budget in AC10.

### Constraints the developer must respect

- **Registration order in `createApp` is a correctness requirement, not style.** `/health` → auth → `express.json()` → routes → error handler. Add a comment saying so, in the style of the existing `/tasks/overdue` ordering comment in `app.ts`.
- **Deny-by-default changes unknown-route behavior.** Without a valid key, `GET /nope` now returns `401`, not `404`. This is intended (it doesn't reveal which routes exist) but it **breaks the existing `tests/health.test.ts` "unknown routes return 404" test**, which must be updated to send a valid key. It does not conflict with any SPEC-001/002 acceptance criterion.
- **Migrate all 51 existing `createApp(...)` call sites** across `tests/tasks.test.ts` (20), `tests/tasks-overdue.test.ts` (18), `tests/tasks-complete-delete.test.ts` (11), `tests/health.test.ts` (2) to `createTestApp(...)` plus `.set('X-API-Key', TEST_API_KEY)`, in the same PR (AC9).
- **The sequential-request constraint in `tests/support/server.ts` still applies** — that harness repoints one shared server synchronously. Do not write concurrent/`Promise.all` auth tests; they pass against the wrong app and fail silently.
- `API_KEY=""` or whitespace-only must be treated as *unconfigured* (`503`), never as a valid key that an empty header would match.
- Never log, echo, or include the presented key in any response body or error message.
- Only ever call `timingSafeEqual` on two equal-length SHA-256 digests.
- Hash the configured key once per app instance, not per request (AC10).
- Duplicate `X-API-Key` headers arrive joined as `"a, b"` and will therefore fail to match → `401`. Acceptable; do not special-case it.
- Do not create or edit `.env*` (CLAUDE.md safety rail). Document `API_KEY` in `poc/README.md` only; a human sets the real value.
- Do not add rate limiting, lockout, or auth audit logging — explicitly out of scope above.

### Security implications — for the security-auditor

- **The comparison primitive** in `src/auth/apiKey.ts`: confirm it is genuinely constant-time over the digest and leaks neither key bytes nor key length.
- **Gate coverage:** confirm no route reaches a handler without passing `requireApiKey` — including unknown paths, and that the trailing body-parse error handler cannot emit task data.
- **Ordering:** confirm auth is registered before `express.json()` so unauthenticated bodies are never parsed.
- **Response uniformity:** `401` wording identical for missing vs. wrong key, no key echoed, key absent from logs and error bodies.
- **Fail-closed:** verify `503` on unconfigured, including the `API_KEY=""` and whitespace-only cases, while `/health` still returns `200`.
- **Accepted residual risks** (in scope to note, not to block): no TLS at this layer (reverse-proxy assumption), no brute-force rate limiting, and a single shared key with no rotation or revocation path.

## Questions for the approver

1. No key configured at startup: fail closed with `503` on protected endpoints (recommended), or some other behavior (fail open / crash at startup)?
2. Should `GET /health` stay unauthenticated, or should it also require the API key?
3. Single shared key for the whole POC (recommended), or per-client keys with issuance/rotation/revocation now?
4. Should this spec route through the architect stage before task planning (recommended: yes), or is it simple enough to go straight to tasks?

---

_Target one page, ceiling two. Tasks derived from this spec: `tasks/TASK-003._`.\*
