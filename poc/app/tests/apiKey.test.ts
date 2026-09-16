import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';

// Mocks node:crypto's timingSafeEqual with a spy that still delegates to the
// real implementation, per the Design's AC7 guidance (specs/SPEC-003-api-key-auth.md
// "Design" > constraint 5). This lets the test assert the constant-time
// primitive was actually invoked during a comparison, without resorting to a
// flaky wall-clock timing measurement. Requires apiKey.ts to import from the
// exact specifier `'node:crypto'`.
const { timingSafeEqualSpy } = vi.hoisted(() => ({
  timingSafeEqualSpy: vi.fn(),
}));

vi.mock('node:crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:crypto')>();
  timingSafeEqualSpy.mockImplementation(actual.timingSafeEqual);
  return {
    ...actual,
    timingSafeEqual: timingSafeEqualSpy,
  };
});

const { apiKeyMatches, requireApiKey } = await import('../src/auth/apiKey.js');

const KEY = 'correct-horse-battery-staple';

function createMockRequest(headerValue: string | undefined): Request {
  const req: Partial<Request> = {
    get: vi.fn().mockImplementation((name: string) => {
      if (name.toLowerCase() === 'x-api-key') {
        return headerValue;
      }
      return undefined;
    }) as unknown as Request['get'],
  };
  return req as Request;
}

function createMockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.type = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('apiKeyMatches', () => {
  it('returns false when provided is undefined', () => {
    expect(apiKeyMatches(undefined, KEY)).toBe(false);
  });

  it('returns true for the exact key', () => {
    expect(apiKeyMatches(KEY, KEY)).toBe(true);
  });

  it('returns false for a different string', () => {
    expect(apiKeyMatches('not-the-key', KEY)).toBe(false);
  });

  it.each([
    ['a prefix of the key', KEY.slice(0, 10)],
    ['the key plus a suffix', `${KEY}-extra`],
    ['a case-flipped key', KEY.toUpperCase()],
    ['a same-length wrong key', KEY.slice(0, -1) + (KEY.at(-1) === 'x' ? 'y' : 'x')],
    ['an empty header value', ''],
  ])('returns false for %s', (_desc, provided) => {
    expect(apiKeyMatches(provided, KEY)).toBe(false);
  });

  it('is case-sensitive and exact-match only, not prefix/partial', () => {
    expect(apiKeyMatches(KEY.slice(0, -1), KEY)).toBe(false);
  });

  it('returns false for a provided value with trailing whitespace, even though it would match once trimmed', () => {
    expect(apiKeyMatches(`${KEY} `, KEY)).toBe(false);
  });

  it('returns false for a provided value with leading whitespace', () => {
    expect(apiKeyMatches(` ${KEY}`, KEY)).toBe(false);
  });

  it('returns false when provided is whitespace-only, even against a matching whitespace-only expected value', () => {
    expect(apiKeyMatches('   ', '   ')).toBe(false);
  });

  it('imports and invokes timingSafeEqual from node:crypto during a comparison', () => {
    timingSafeEqualSpy.mockClear();

    apiKeyMatches(KEY, KEY);

    expect(timingSafeEqualSpy).toHaveBeenCalledTimes(1);
    const [a, b] = timingSafeEqualSpy.mock.calls[0] as [Buffer, Buffer];
    expect(Buffer.isBuffer(a)).toBe(true);
    expect(Buffer.isBuffer(b)).toBe(true);
    // Both are SHA-256 digests, not the raw key material.
    expect(a).toHaveLength(32);
    expect(b).toHaveLength(32);
  });

  it('invokes timingSafeEqual even when provided and expected have different lengths (no length-based early return)', () => {
    // Guards against a shortcut like `if (provided.length !== expected.length)
    // return false;`, which would leak the configured key's length via a
    // fast, hash-free early return. If that shortcut is (re)introduced,
    // timingSafeEqual is skipped for this case and the assertion below fails.
    timingSafeEqualSpy.mockClear();

    apiKeyMatches(KEY.slice(0, 10), KEY);

    expect(timingSafeEqualSpy).toHaveBeenCalledTimes(1);
  });

  it('does not invoke timingSafeEqual when provided is undefined (missing-header early return)', () => {
    timingSafeEqualSpy.mockClear();

    apiKeyMatches(undefined, KEY);

    expect(timingSafeEqualSpy).not.toHaveBeenCalled();
  });
});

describe('requireApiKey', () => {
  it('responds 503 with the standard error shape when no key is configured, regardless of headers', () => {
    const handler = requireApiKey(undefined);
    const next = vi.fn() as unknown as NextFunction;

    for (const headerValue of [undefined, '', KEY, 'wrong-key']) {
      const req = createMockRequest(headerValue);
      const res = createMockResponse();

      handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.type).toHaveBeenCalledWith('application/json');
      expect(res.json).toHaveBeenCalledWith({
        error: { message: 'authentication is not configured' },
      });
      expect(next).not.toHaveBeenCalled();
    }
  });

  it('responds 503 when the configured key is an empty string', () => {
    const handler = requireApiKey('');
    const next = vi.fn() as unknown as NextFunction;
    const req = createMockRequest(KEY);
    const res = createMockResponse();

    handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'authentication is not configured' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 503 when the configured key is whitespace-only', () => {
    const handler = requireApiKey('   ');
    const next = vi.fn() as unknown as NextFunction;
    const req = createMockRequest('   ');
    const res = createMockResponse();

    handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'authentication is not configured' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401, never next(), when the header is empty or whitespace-only', () => {
    const handler = requireApiKey(KEY);
    const next = vi.fn() as unknown as NextFunction;

    for (const headerValue of ['', '   ']) {
      const req = createMockRequest(headerValue);
      const res = createMockResponse();

      handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: { message: 'missing or invalid API key' },
      });
    }
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 when the header carries the correct key plus trailing whitespace', () => {
    const handler = requireApiKey(KEY);
    const next = vi.fn() as unknown as NextFunction;
    const req = createMockRequest(`${KEY} `);
    const res = createMockResponse();

    handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'missing or invalid API key' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 with a fixed message when the header is missing', () => {
    const handler = requireApiKey(KEY);
    const next = vi.fn() as unknown as NextFunction;
    const req = createMockRequest(undefined);
    const res = createMockResponse();

    handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'missing or invalid API key' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('responds 401 with the same fixed message when the header holds the wrong key', () => {
    const handler = requireApiKey(KEY);
    const next = vi.fn() as unknown as NextFunction;
    const req = createMockRequest('wrong-key');
    const res = createMockResponse();

    handler(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { message: 'missing or invalid API key' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('never echoes the submitted key value in the 401 response body', () => {
    const handler = requireApiKey(KEY);
    const next = vi.fn() as unknown as NextFunction;
    const req = createMockRequest('some-submitted-value-12345');
    const res = createMockResponse();

    handler(req, res, next);

    const jsonMock = res.json as unknown as { mock: { calls: unknown[][] } };
    const body = JSON.stringify(jsonMock.mock.calls[0]?.[0]);
    expect(body).not.toContain('some-submitted-value-12345');
  });

  it('calls next() and does not respond when the header matches the configured key exactly', () => {
    const handler = requireApiKey(KEY);
    const next = vi.fn() as unknown as NextFunction;
    const req = createMockRequest(KEY);
    const res = createMockResponse();

    handler(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });
});

describe('apiKeyMatches performance smoke check (isolated half of AC10, POC-scale)', () => {
  // The other half — in-app p95 regression against a live GET /tasks/overdue —
  // is verified in TASK-003.2, once requireApiKey is actually wired in.
  function p95(durations: number[]): number {
    const sorted = [...durations].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
  }

  it('p95 latency for apiKeyMatches is under 5ms across at least 1,000 calls', () => {
    const callCount = 1000;
    const durations: number[] = [];

    for (let i = 0; i < callCount; i += 1) {
      const start = performance.now();
      apiKeyMatches(KEY, KEY);
      durations.push(performance.now() - start);
    }

    expect(p95(durations)).toBeLessThan(5);
  });
});
