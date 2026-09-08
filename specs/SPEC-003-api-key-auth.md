# SPEC-003: API-Key Authentication

**Status:** Draft
**Requirement source:** poc/README.md sample requirements queue, item #3
**Date:** 2026-09-08

## Open questions & assumptions

<!-- Deliberately first: the approver reads the doubts before the plan. -->
- **Q:** Where is the valid API key configured?
  **A (assumption):** A single key read from the `API_KEY` environment variable at server startup (mirrors the existing `PORT` pattern in `server.ts`). Per CLAUDE.md, agents never touch `.env`/secrets — a human sets `API_KEY` in the deployment environment. For tests, `createApp()` gains an optional config parameter so a key can be injected directly (mirrors the existing `store` injection pattern already used for perf/seed tests), bypassing env vars entirely.
- **Q:** Which header carries the key?
  **A (assumption):** A custom `X-API-Key` header, not `Authorization: Bearer`. `Bearer` implies OAuth2/JWT semantics (scopes, expiry, token issuance) this feature doesn't have; `X-API-Key` is the conventional, unambiguous choice for a single static shared secret.
- **Q:** Which endpoints are protected — is `GET /health` exempt?
  **A (assumption):** `GET /health` stays open (no key required) — it's used by monitoring/uptime tooling that typically can't hold the key, and it exposes no task data. Every `/tasks*` endpoint (`POST /tasks`, `GET /tasks`, `GET /tasks/overdue`, `POST /tasks/:id/complete`, `DELETE /tasks/:id`) requires the key.
- **Q:** 401 vs 403 for missing vs. invalid key?
  **A (assumption):** Both return `401`. This feature has exactly one permission tier (valid key or not) — there's no "authenticated but forbidden" case to justify `403`. Reuses the existing `{"error":{"message"}}` shape, `Content-Type: application/json`, unmodified from SPEC-001/002.
- **Q:** Single shared key, or per-client keys?
  **A (assumption):** One shared key for the whole POC, matching "simple API-key authentication" in the raw requirement. Per-client keys, issuance, rotation, and revocation are explicitly out of scope — flagging this as the item most likely to come back if this ever gates real multi-user traffic.
- **Q:** Does the comparison need to be timing-safe?
  **A (assumption):** Yes. A naive `===` string comparison leaks the key byte-by-byte via response-time side channels. This spec requires a constant-time comparison; deferring the exact primitive to implementation would leave a security decision to whichever library a developer agent happens to reach for.
- **Q:** What happens when the server has no key configured?
  **A (assumption):** Fail closed — every protected endpoint returns `503` with the standard error shape; `/health` still returns `200`. Rejected alternatives: fail-open (silently allows all unauthenticated traffic — unacceptable for a security feature) and crash-at-startup (turns a config oversight into a total outage with no diagnosable response).
- **Q:** Rate limiting / lockout on repeated invalid-key attempts?
  **A (assumption):** Out of scope for this spec. Follow-up if the API is ever exposed beyond the POC's trusted demo environment.
- **Q:** Is this design-significant enough to require the architect stage before planning?
  **A: Yes, explicitly.** This is called out in `poc/README.md` itself ("Requirement 3 is deliberately security-adjacent to exercise the architect and (later) security-auditor paths"). Auth touches every existing endpoint, introduces a new security-sensitive comparison primitive, and has failure-mode implications (see fail-closed decision above). Per repo convention this spec does not design the implementation — the **Design** section below is left for the architect to fill before `TASK-003.*` is written; the planner should not proceed straight from this Draft to tasks without that pass.

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

<!-- Objectively checkable. QA tests these verbatim; planner maps every one to a task.
     Include performance budgets where relevant. -->
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

<!-- Architect agent fills this section only for design-significant specs; otherwise delete. -->
Design-significant — reserved for the architect agent (see final item in Open questions & assumptions). Do not proceed to task planning until this section is filled and the spec is re-reviewed.

---
*Target one page, ceiling two. Tasks derived from this spec: `tasks/TASK-003.*`.*
