import { describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';
import { sendError } from '../src/errors.js';

function createMockResponse(): Response {
  const res: Partial<Response> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.type = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res as Response;
}

describe('sendError', () => {
  it('writes the standard error body and sets the status code', () => {
    const res = createMockResponse();

    sendError(res, 400, 'title is required');

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: { message: 'title is required' } });
  });

  it('sets Content-Type: application/json', () => {
    const res = createMockResponse();

    sendError(res, 404, 'task not found');

    expect(res.type).toHaveBeenCalledWith('application/json');
  });
});
