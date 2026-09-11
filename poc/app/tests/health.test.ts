import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { setupTestServer } from './support/server.js';

// One server is bound for this whole file and reused for every request; see
// tests/support/server.ts for what request(app) does and its constraints.
const request = setupTestServer();

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
