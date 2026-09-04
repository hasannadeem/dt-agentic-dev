import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { sendError } from './errors.js';
import { TaskStore } from './store/taskStore.js';
import { validateDueDate } from './validation/dueDate.js';
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

/**
 * Builds the Express app. Accepts an optional `store` so tests can seed
 * state directly (in-process, bypassing HTTP) before wiring it into the
 * app — e.g. for perf smoke checks that need many tasks without the
 * overhead/flakiness of seeding via hundreds of supertest requests.
 * Defaults to a fresh, empty `TaskStore` when omitted.
 */
export function createApp(store: TaskStore = new TaskStore()): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.post('/tasks', (req, res) => {
    const body = req.body as { title?: unknown; dueDate?: unknown } | undefined;

    const titleResult = validateTaskTitle(body?.title);
    if (!titleResult.valid) {
      sendError(res, 400, titleResult.reason);
      return;
    }

    const dueDateResult = validateDueDate(body?.dueDate);
    if (!dueDateResult.valid) {
      sendError(res, 400, dueDateResult.reason);
      return;
    }

    const task = store.create(titleResult.title, dueDateResult.dueDate);
    res.status(201).json(task);
  });

  app.get('/tasks', (_req, res) => {
    res.json(store.list());
  });

  // Registered as a static path ('/tasks/overdue'), which currently cannot
  // collide with any '/tasks/:id' pattern because those are only registered
  // on POST/DELETE, not GET. Express matches routes in registration order,
  // so if a GET '/tasks/:id' route is ever added, this route MUST stay
  // registered before it — otherwise the param route would shadow this one
  // by treating "overdue" as an :id value.
  app.get('/tasks/overdue', (_req, res) => {
    res.json(store.listOverdue());
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
