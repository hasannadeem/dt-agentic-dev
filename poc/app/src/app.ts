import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { sendError } from './errors.js';
import { TaskStore } from './store/taskStore.js';
import { validateTaskTitle } from './validation/taskTitle.js';

/**
 * Extracts a numeric HTTP status from a thrown error, checking the
 * conventional `status` and `statusCode` properties used by
 * `express.json()`/`body-parser` errors (e.g. malformed JSON, payload
 * too large). Returns `undefined` if no numeric status is present.
 */
function getHttpErrorStatus(err: unknown): number | undefined {
  if (typeof err !== 'object' || err === null) {
    return undefined;
  }
  const candidate = err as { status?: unknown; statusCode?: unknown };
  if (typeof candidate.status === 'number') {
    return candidate.status;
  }
  if (typeof candidate.statusCode === 'number') {
    return candidate.statusCode;
  }
  return undefined;
}

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  const store = new TaskStore();

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/tasks', (req, res) => {
    const result = validateTaskTitle((req.body as { title?: unknown } | undefined)?.title);
    if (!result.valid) {
      sendError(res, 400, result.reason);
      return;
    }

    const task = store.create(result.title);
    res.status(201).json(task);
  });

  app.get('/tasks', (_req, res) => {
    res.json(store.list());
  });

  app.post('/tasks/:id/complete', (req, res) => {
    const task = store.complete(req.params.id);
    if (!task) {
      sendError(res, 404, `task not found: ${req.params.id}`);
      return;
    }
    res.status(200).json(task);
  });

  app.delete('/tasks/:id', (req, res) => {
    const removed = store.remove(req.params.id);
    if (!removed) {
      sendError(res, 404, `task not found: ${req.params.id}`);
      return;
    }
    res.status(204).end();
  });

  // Feature routes are added by the developer agent, one task branch at a time.
  // See specs/ for approved specs and tasks/ for the task breakdown.

  // Handles express.json() body-parse failures (malformed JSON, oversized
  // payload, etc.) with the standard error shape instead of Express's
  // default HTML 4xx response. Must be registered after the routes it
  // protects. Per SPEC-001, every 4xx response — not just validation
  // failures — must carry the `{"error":{"message"}}` JSON body.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    const status = getHttpErrorStatus(err);
    if (status === undefined || status < 400 || status >= 500) {
      next(err);
      return;
    }

    if (status === 413) {
      sendError(res, 413, 'request body too large');
      return;
    }

    if (err instanceof SyntaxError && 'body' in err) {
      sendError(res, status, 'malformed JSON body');
      return;
    }

    const message = err instanceof Error ? err.message : 'bad request';
    sendError(res, status, message);
  });

  return app;
}
