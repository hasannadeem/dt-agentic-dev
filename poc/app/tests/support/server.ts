import type { Express } from 'express';
import { createServer } from 'node:http';
import type { Server } from 'node:http';
import { afterAll, beforeAll } from 'vitest';
import supertestRequest from 'supertest';

/**
 * A single ephemeral-port server, bound once and reused for every request
 * issued from it, closed once when its owner is done with it.
 */
interface TestServer {
  readonly server: Server;
  /**
   * Points the already-listening server at `app` for every request from
   * here on, without opening a new port. This swaps the in-process request
   * handler on the existing socket — see the constraints on
   * `setupTestServer` below for what that does and doesn't make safe.
   */
  use(app: Express): void;
  /** Stops listening. */
  close(): Promise<void>;
}

async function bindTestServer(): Promise<TestServer> {
  const server = createServer();

  await new Promise<void>((resolve, reject) => {
    function onBindError(err: Error): void {
      reject(err);
    }
    server.once('error', onBindError);
    server.once('listening', () => {
      server.off('error', onBindError);
      resolve();
    });
    server.listen(0);
  });

  // A listening server with zero 'error' listeners crashes the process if
  // one ever fires (Node re-throws unhandled 'error' events on an
  // EventEmitter) — keep exactly one attached for as long as the server
  // itself lives, rather than just the bind-time listener above, which is
  // removed once 'listening' fires so it can't later reject an
  // already-settled promise.
  server.on('error', (err) => {
    console.error('tests/support/server.ts: server error after startup', err);
  });

  return {
    server,
    use(app: Express): void {
      server.removeAllListeners('request');
      server.on('request', app);
    },
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/**
 * Binds one server for an entire test file and returns a drop-in
 * `request(app)` function to use in place of supertest's own `request`
 * throughout that file. Registers the bind/close as `beforeAll`/`afterAll`
 * hooks itself:
 *
 *   const request = setupTestServer();
 *   ...
 *   const res = await request(createApp()).get('/tasks');
 *
 * Why: supertest's `request(app)` starts a fresh ephemeral-port server for
 * every call. A suite that does this dozens/hundreds of times
 * intermittently lands on a port another local process is using, and the
 * response then comes from that process rather than the app under test —
 * observed as an impossible status (a 404 from a valid POST, a 401 from an
 * app with no auth routes). The function returned here instead repoints
 * one already-listening server at `app` (swapping its `'request'`
 * listener, not opening a new port) before issuing the request through it,
 * so a file binds and closes exactly one server no matter how many
 * apps/stores its tests use for isolation.
 *
 * Constraints — every call site in this suite already fits this (a plain
 * sequential `await request(app)...` chain), but the wrapper is NOT a
 * drop-in replacement for concurrent or deferred use, and breaks silently
 * rather than erroring if that changes:
 * - Issue and await one request at a time. `request(app)` repoints the
 *   shared server *synchronously*, the instant it's called — it does not
 *   scope `app` to the one request being built. Two calls made before
 *   either is awaited race on the same server and both resolve against
 *   whichever app was passed to the *last* call, regardless of which each
 *   was built from — confirmed with a probe:
 *     `await Promise.all([request(a).get('/x'), request(b).get('/x')])`
 *     resolves both against `b`.
 * - A request built from an earlier `request(app)` call but sent/awaited
 *   after a later `request(otherApp)` call is answered by `otherApp`, not
 *   `app` — e.g. `const p = request(a).get('/x'); request(b); await p;`
 *   resolves `p` against `b`.
 *
 * The server is created with no `'request'` listener, which is why only this
 * wrapper is exported: the raw server is never reachable, and the wrapper
 * always installs a listener before building a request, so no test can issue
 * one against an unattached server.
 */
export function setupTestServer(): (app: Express) => ReturnType<typeof supertestRequest> {
  let testServer: TestServer | undefined;
  let serverError: Error | undefined;

  beforeAll(async () => {
    testServer = await bindTestServer();
    testServer.server.on('error', (err) => {
      // Captured rather than only logged: an error raised while no request is
      // in flight would otherwise leave a passing run with a stderr line
      // nobody reads. Rethrown below so the file fails loudly instead.
      serverError ??= err;
    });
  });

  afterAll(async () => {
    // Guarded: if bindTestServer rejected, this would otherwise throw a
    // TypeError that buries the real beforeAll failure.
    await testServer?.close();
    if (serverError) throw serverError;
  });

  return (app: Express): ReturnType<typeof supertestRequest> => {
    if (!testServer) {
      // Only reachable if a test issues a request outside the beforeAll/afterAll
      // window. A clear message beats a TypeError about undefined.
      throw new Error('setupTestServer(): no server bound — call request(app) from inside a test.');
    }
    testServer.use(app);
    return supertestRequest(testServer.server);
  };
}
