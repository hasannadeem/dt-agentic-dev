import type { Express } from 'express';
import { createServer } from 'node:http';
import type { Server } from 'node:http';

/**
 * A single ephemeral-port server, bound once (typically in a file's
 * `beforeAll`) and reused for every request issued from that file, closed
 * once (in `afterAll`).
 */
export interface TestServer {
  /** The listening server. Pass to supertest's `request(...)`. */
  readonly server: Server;
  /**
   * Points the already-listening server at `app` for every request from
   * here on, without opening a new port. Call at the start of any test
   * that needs its own fresh app/store — this swaps the in-process request
   * handler on the existing socket, so no new port is ever bound.
   */
  use(app: Express): void;
  /** Stops listening. Call once, after every test in the file has run. */
  close(): Promise<void>;
}

/**
 * Binds one server for reuse across an entire test file, via a
 * `beforeAll`/`afterAll` pair:
 *
 *   let testServer: TestServer;
 *   beforeAll(async () => { testServer = await bindTestServer(); });
 *   afterAll(async () => { await testServer.close(); });
 *
 * `request(app)` (supertest) starts a fresh ephemeral-port server for
 * every call. A suite that does this dozens/hundreds of times
 * intermittently lands on a port another local process is using, and the
 * response then comes from that process rather than the app under test —
 * observed as an impossible status (a 404 from a valid POST, a 401 from an
 * app with no auth routes). Binding once per file and reusing it (via
 * `use()` to repoint at a fresh app/store wherever a test needs isolation)
 * removes the race entirely; every request still traverses real HTTP.
 *
 * Scope (accurate as of TASK-000.3): every `request()` call site under
 * `tests/` — perf loops and single-shot functional assertions alike —
 * goes through a server bound this way. None binds a fresh ephemeral-port
 * server per call, and no test file binds more than one server.
 */
export async function bindTestServer(): Promise<TestServer> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
    server.listen(0);
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
