import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import baseRequest from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { bindTestServer } from './support/server.js';
import type { TestServer } from './support/server.js';

// One server is bound for this whole file (see tests/support/server.ts) and
// reused for every request; `request(app)` below is a local wrapper that
// repoints it at the given app, preserving each test's own fresh app
// without opening a new ephemeral-port server per call.
let testServer: TestServer;

beforeAll(async () => {
  testServer = await bindTestServer();
});

afterAll(async () => {
  await testServer.close();
});

function request(app: Express): ReturnType<typeof baseRequest> {
  testServer.use(app);
  return baseRequest(testServer.server);
}

describe('GET /health', () => {
  it('returns ok', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('unknown routes return 404', async () => {
    const res = await request(createApp()).get('/nope');
    expect(res.status).toBe(404);
  });
});
