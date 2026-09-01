import type { Response } from 'express';

/**
 * Writes the shared JSON error-response shape `{"error": {"message": string}}`
 * with the given HTTP status code and `Content-Type: application/json`.
 */
export function sendError(res: Response, status: number, message: string): void {
  res.status(status).type('application/json').json({ error: { message } });
}
