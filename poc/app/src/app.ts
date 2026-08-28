import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { sendError } from './errors.js';
import { TaskStore } from './store/taskStore.js';
import { validateTaskTitle } from './validation/taskTitle.js';

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

  // Feature routes are added by the developer agent, one task branch at a time.
  // See specs/ for approved specs and tasks/ for the task breakdown.

  // Handles express.json() body-parse failures (malformed JSON) with the
  // standard error shape instead of the default HTML 400/500 response.
  // Must be registered after the routes it protects.
  app.use((err: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'status' in err && (err as { status?: number }).status === 400 && 'body' in err) {
      sendError(res, 400, 'malformed JSON body');
      return;
    }
    next(err);
  });

  return app;
}
