import { describe, expect, it, vi } from 'vitest';
import type { NextFunction, Request, Response } from 'express';
import { requireApiKey } from '../src/middleware/requireApiKey.js';

const TEST_KEY = 'correct-key';

// Only answers `req.header('X-API-Key')`; any other header name returns
// `undefined`, so a middleware reading the wrong header name (e.g.
// 'Authorization') gets no value and the surrounding test fails instead of
// silently passing.
function createMockRequest(headerValue?: string): Request {
  const header = vi.fn((name: string) => (name === 'X-API-Key' ? headerValue : undefined));
  const req: Partial<Request> = {
    header: header as unknown as Request['header'],
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

function createMockNext(): NextFunction {
  return vi.fn() as unknown as NextFunction;
}

describe('requireApiKey', () => {
  describe('no key configured (apiKey: null)', () => {
    it('responds 503 with the standard error shape, and never calls next()', () => {
      const middleware = requireApiKey({ apiKey: null });
      const req = createMockRequest(undefined);
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.type).toHaveBeenCalledWith('application/json');
      expect(res.json).toHaveBeenCalledWith({
        error: { message: 'api key authentication is not configured' },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('responds 503 even when a request happens to present a key', () => {
      const middleware = requireApiKey({ apiKey: null });
      const req = createMockRequest('anything');
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(next).not.toHaveBeenCalled();
    });
  });

  // Security-auditor follow-up on TASK-003.1: createKeyMatcher('') matches
  // an empty presented key, so an unnormalized '' or whitespace-only
  // apiKey reaching this middleware without being re-normalized would be an
  // authentication bypass (any request with no X-API-Key header presents
  // `undefined`, which createKeyMatcher hashes as ''). These tests fail if
  // the normalizeConfiguredKey() call is ever removed from requireApiKey.
  describe('unconfigured key represented as empty/whitespace string (not null)', () => {
    it('treats apiKey: "" as unconfigured and fails closed with 503, not a bypass', () => {
      const middleware = requireApiKey({ apiKey: '' });
      const req = createMockRequest(undefined);
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(next).not.toHaveBeenCalled();
    });

    it('treats apiKey: "   " (whitespace-only) as unconfigured and fails closed with 503', () => {
      const middleware = requireApiKey({ apiKey: '   ' });
      const req = createMockRequest(undefined);
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('key configured, missing X-API-Key header', () => {
    it('responds 401 with the fixed message, and never calls next()', () => {
      const middleware = requireApiKey({ apiKey: TEST_KEY });
      const req = createMockRequest(undefined);
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.type).toHaveBeenCalledWith('application/json');
      expect(res.json).toHaveBeenCalledWith({
        error: { message: 'missing or invalid api key' },
      });
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('key configured, wrong X-API-Key header', () => {
    it('responds 401 with the identical message text used for a missing key', () => {
      const middleware = requireApiKey({ apiKey: TEST_KEY });
      const req = createMockRequest('wrong-key');
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        error: { message: 'missing or invalid api key' },
      });
      expect(next).not.toHaveBeenCalled();
    });

    it('never echoes the submitted key value anywhere in the response body', () => {
      const middleware = requireApiKey({ apiKey: TEST_KEY });
      const submittedKey = 'super-secret-guess-12345';
      const req = createMockRequest(submittedKey);
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      const jsonMock = res.json as unknown as ReturnType<typeof vi.fn>;
      const body = jsonMock.mock.calls[0]?.[0];
      expect(JSON.stringify(body)).not.toContain(submittedKey);
    });

    it('is case-sensitive: a differently-cased key does not match', () => {
      const middleware = requireApiKey({ apiKey: 'Correct-Key' });
      const req = createMockRequest('correct-key');
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    });
  });

  describe('key configured, X-API-Key exactly matches', () => {
    it('calls next() and writes no response itself', () => {
      const middleware = requireApiKey({ apiKey: TEST_KEY });
      const req = createMockRequest(TEST_KEY);
      const res = createMockResponse();
      const next = createMockNext();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
      expect(req.header).toHaveBeenCalledWith('X-API-Key');
    });
  });
});
