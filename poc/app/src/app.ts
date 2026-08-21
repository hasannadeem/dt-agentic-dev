import express from 'express';

export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  // Feature routes are added by the developer agent, one task branch at a time.
  // See specs/ for approved specs and tasks/ for the task breakdown.

  return app;
}
