import type { Express } from 'express';
import type { Server } from 'node:http';

/**
 * Runs `fn` against a single listening server.
 *
 * `request(app)` starts a fresh ephemeral-port server for every call. A loop
 * that does this dozens of times intermittently lands on a port another local
 * process is using, and the response then comes from that process rather than
 * the app under test — observed as an impossible status (a 404 from a valid
 * POST, a 401 from an app with no auth). Binding once and reusing the server
 * removes the race entirely; the measured requests still traverse real HTTP.
 */
export async function withServer<T>(
  app: Express,
  fn: (server: Server) => Promise<T>,
): Promise<T> {
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  try {
    return await fn(server);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}
