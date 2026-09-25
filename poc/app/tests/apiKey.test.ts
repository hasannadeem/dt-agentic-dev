import { afterEach, describe, expect, it, vi } from 'vitest';

// vi.spyOn cannot redefine a live ESM binding ("Module namespace is not
// configurable in ESM"), so we mock the module instead, wrapping the real
// `createHash`/`timingSafeEqual` in `vi.fn` spies that still delegate to the
// original implementation. This lets tests assert call counts/arguments
// while exercising the genuine constant-time comparison.
const { createHashSpy, timingSafeEqualSpy } = vi.hoisted(() => ({
  createHashSpy: vi.fn(),
  timingSafeEqualSpy: vi.fn(),
}));

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  return {
    ...actual,
    createHash: createHashSpy.mockImplementation(actual.createHash),
    timingSafeEqual: timingSafeEqualSpy.mockImplementation(actual.timingSafeEqual),
  };
});

const { createKeyMatcher, normalizeConfiguredKey } = await import('../src/auth/apiKey.js');

describe('normalizeConfiguredKey', () => {
  it('treats undefined as not configured (null)', () => {
    expect(normalizeConfiguredKey(undefined)).toBeNull();
  });

  it('treats an empty string as not configured (null)', () => {
    expect(normalizeConfiguredKey('')).toBeNull();
  });

  it('treats a whitespace-only string as not configured (null)', () => {
    expect(normalizeConfiguredKey('   ')).toBeNull();
  });

  it('trims and returns a non-empty, non-whitespace-only key', () => {
    expect(normalizeConfiguredKey('  secret-key  ')).toBe('secret-key');
  });

  it('returns an already-trimmed key unchanged', () => {
    expect(normalizeConfiguredKey('secret-key')).toBe('secret-key');
  });
});

describe('createKeyMatcher', () => {
  afterEach(() => {
    // Clear call history between tests, but keep the real-implementation
    // delegation set up in the vi.mock factory above intact — restoring
    // would strip the mocked module's only implementation.
    createHashSpy.mockClear();
    timingSafeEqualSpy.mockClear();
  });

  it('returns true for a presented value exactly equal to the configured key', () => {
    const matches = createKeyMatcher('correct-key');
    expect(matches('correct-key')).toBe(true);
  });

  it('returns false for a differing-case presented value', () => {
    const matches = createKeyMatcher('Correct-Key');
    expect(matches('correct-key')).toBe(false);
  });

  it('returns false for a substring/prefix of the configured key', () => {
    const matches = createKeyMatcher('correct-key');
    expect(matches('correct')).toBe(false);
  });

  it('returns false for the configured key with trailing whitespace', () => {
    const matches = createKeyMatcher('correct-key');
    expect(matches('correct-key ')).toBe(false);
  });

  it('returns false for the configured key with leading whitespace', () => {
    const matches = createKeyMatcher('correct-key');
    expect(matches(' correct-key')).toBe(false);
  });

  it('returns false for a completely wrong value', () => {
    const matches = createKeyMatcher('correct-key');
    expect(matches('wrong-key')).toBe(false);
  });

  it('never throws for a missing/undefined presented value, and returns false', () => {
    const matches = createKeyMatcher('correct-key');
    expect(() => matches(undefined)).not.toThrow();
    expect(matches(undefined)).toBe(false);
  });

  it('never throws for an empty-string presented value, and returns false', () => {
    const matches = createKeyMatcher('correct-key');
    expect(() => matches('')).not.toThrow();
    expect(matches('')).toBe(false);
  });

  it('uses crypto.timingSafeEqual over two fixed-length SHA-256 digests to compare', () => {
    const matches = createKeyMatcher('correct-key');

    matches('correct-key');

    expect(timingSafeEqualSpy).toHaveBeenCalledTimes(1);
    const [a, b] = timingSafeEqualSpy.mock.calls[0] as [Buffer, Buffer];
    expect(a).toHaveLength(32);
    expect(b).toHaveLength(32);
  });

  it("returns false when timingSafeEqual reports no match, even for the correct key (rules out a `presented === configuredKey` short-circuit)", () => {
    const matches = createKeyMatcher('correct-key');
    timingSafeEqualSpy.mockReturnValueOnce(false);

    expect(matches('correct-key')).toBe(false);
  });

  it("returns true when timingSafeEqual reports a match, even for a differing key (rules out a `presented === configuredKey` short-circuit)", () => {
    const matches = createKeyMatcher('correct-key');
    timingSafeEqualSpy.mockReturnValueOnce(true);

    expect(matches('wrong-key')).toBe(true);
  });

  it('computes the configured key digest once at construction, not per comparison', () => {
    const matches = createKeyMatcher('correct-key');

    // One createHash call for the configured key, at construction time.
    expect(createHashSpy).toHaveBeenCalledTimes(1);

    matches('a');
    matches('b');
    matches('c');

    // Exactly one additional createHash call per comparison (for the
    // presented value); the configured-key digest is never recomputed.
    expect(createHashSpy).toHaveBeenCalledTimes(4);
  });
});
