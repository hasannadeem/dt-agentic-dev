import { createHash, timingSafeEqual } from 'node:crypto';

/**
 * Normalizes a raw, untrusted `API_KEY` environment value.
 *
 * Trims surrounding whitespace. `undefined`, an empty string, or a
 * whitespace-only string all collapse to `null`, meaning "not configured" —
 * per SPEC-003, an unconfigured key must fail closed, never accidentally
 * match an empty presented header.
 */
export function normalizeConfiguredKey(raw: string | undefined): string | null {
  if (raw === undefined) {
    return null;
  }

  const trimmed = raw.trim();
  return trimmed.length === 0 ? null : trimmed;
}

/**
 * Builds a constant-time matcher for a single configured API key.
 *
 * The SHA-256 digest of `configuredKey` is computed once, here, at
 * construction time — not per request — per SPEC-003's performance budget
 * (AC10). The returned closure hashes the presented value on each call and
 * compares the two fixed-length 32-byte digests with `timingSafeEqual`.
 * Comparing digests (rather than raw key bytes) is what makes this both
 * constant-time *and* length-non-leaking: `timingSafeEqual` throws on
 * unequal-length buffers, so comparing raw bytes would first have to branch
 * on `.length`, leaking it. There is no `===` fallback after the digest
 * comparison.
 *
 * The returned function never throws: a missing/`undefined` presented value
 * is hashed as the empty string and simply fails to match.
 */
export function createKeyMatcher(
  configuredKey: string,
): (presented: string | undefined) => boolean {
  const configuredDigest = createHash('sha256').update(configuredKey).digest();

  return function matches(presented: string | undefined): boolean {
    const presentedDigest = createHash('sha256').update(presented ?? '').digest();
    return timingSafeEqual(presentedDigest, configuredDigest);
  };
}
