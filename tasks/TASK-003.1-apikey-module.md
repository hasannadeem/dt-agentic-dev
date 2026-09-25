# TASK-003.1: Pure API-key check module (`src/auth/apiKey.ts`)

**Spec:** SPEC-003 (specs/SPEC-003-api-key-auth.md)
**Size:** S
**Depends on:** none — parallelizable
**Status:** Todo
**Branch:** task/003.1-apikey-module

## Intent

Add a pure, separately unit-tested module mirroring `src/validation/*`: `normalizeConfiguredKey` (turns `undefined`/empty/whitespace-only into `null`, meaning "not configured") and `createKeyMatcher` (constant-time, SHA-256-digest comparison via `timingSafeEqual`, computed once per app instance).

## Approach

- `poc/app/src/auth/apiKey.ts`, exporting exactly the two functions in the spec's Design section:
  `normalizeConfiguredKey(raw: string | undefined): string | null` and
  `createKeyMatcher(configuredKey: string): (presented: string | undefined) => boolean`.
- `createKeyMatcher` hashes `configuredKey` with `createHash('sha256')` once, at call time (not per comparison), and returns a closure that hashes `presented ?? ''` per call and compares the two digests with `timingSafeEqual`. Never falls back to `===` after the digest match.
- No Express/`Request`/`Response` types in this file — it stays pure, per the spec's module boundary.

## Done-criteria

1. `normalizeConfiguredKey(undefined)`, `normalizeConfiguredKey('')`, and `normalizeConfiguredKey('   ')` all return `null`; a non-empty, non-whitespace-only key (after trimming) returns the trimmed string (covers SPEC acceptance criterion #8's "not configured" detection).
2. `createKeyMatcher` returns `true` only for a presented value exactly equal to the configured key, case-sensitively — differing case, a substring/prefix, or trailing/leading whitespace all return `false` (covers acceptance criterion #5).
3. `createKeyMatcher`'s returned function never throws for a missing/`undefined` presented value — it returns `false` (supports acceptance criterion #2/#3 not crashing the request).
4. The comparison is implemented via `crypto.timingSafeEqual` over two fixed-length SHA-256 digests, with no `===`/short-circuiting comparison on raw key bytes anywhere in the match path — verified by a unit test that inspects/exercises the implementation (not wall-clock timing) (covers acceptance criterion #7).
5. The digest of the configured key is computed once when `createKeyMatcher` is called, not inside the returned per-request closure (supports acceptance criterion #10's performance budget).
6. Tests exist for each criterion above and pass locally via `npm run test`.
7. `npm run lint` and `npm run typecheck` are clean.

## Notes / escalations

- This module has no Express dependency and no knowledge of HTTP status codes or error shapes — that belongs to TASK-003.2. If scope pressure tempts folding the two together, stop and keep the boundary the spec specifies (pure module vs. Express glue), matching the existing `validation/` vs. `app.ts` split.
