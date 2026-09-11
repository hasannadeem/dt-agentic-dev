import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import baseRequest from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { TaskStore } from '../src/store/taskStore.js';
import { bindTestServer } from './support/server.js';
import type { TestServer } from './support/server.js';

// One server is bound for this whole file (see tests/support/server.ts) and
// reused for every request; `request(app)` below is a local wrapper that
// repoints it at the given app, preserving each test's own fresh app/store
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

async function createTask(app: ReturnType<typeof createApp>, title: string, dueDate?: string) {
  const res = await request(app)
    .post('/tasks')
    .send(dueDate === undefined ? { title } : { title, dueDate });
  return res.body as {
    id: string;
    title: string;
    completed: boolean;
    createdAt: string;
    dueDate: string | null;
  };
}

describe('POST /tasks/:id/complete', () => {
  it('returns 200 with completed: true, and unchanged id/title/createdAt (SPEC-001 #6)', async () => {
    const app = createApp();
    const created = await createTask(app, 'Buy milk');

    const res = await request(app).post(`/tasks/${created.id}/complete`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: created.id,
      title: created.title,
      completed: true,
      createdAt: created.createdAt,
      dueDate: null,
    });
  });

  it('is idempotent: calling it again on an already-completed task returns 200, completed remains true, no error (SPEC-001 #7)', async () => {
    const app = createApp();
    const created = await createTask(app, 'Buy milk');

    const first = await request(app).post(`/tasks/${created.id}/complete`);
    expect(first.status).toBe(200);
    expect(first.body.completed).toBe(true);

    const second = await request(app).post(`/tasks/${created.id}/complete`);
    expect(second.status).toBe(200);
    expect(second.body).toEqual({
      id: created.id,
      title: created.title,
      completed: true,
      createdAt: created.createdAt,
      dueDate: null,
    });
  });

  it('returns 404 with the standard error body for a non-existent id (SPEC-001 #8)', async () => {
    const app = createApp();

    const res = await request(app).post('/tasks/does-not-exist/complete');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: { message: expect.any(String) } });
  });

  it('returns the task\'s unchanged dueDate when completing a task created with a dueDate (SPEC-002 #5)', async () => {
    const app = createApp();
    const created = await createTask(app, 'Pay rent', '2026-09-10T00:00:00.000Z');

    const res = await request(app).post(`/tasks/${created.id}/complete`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: created.id,
      title: created.title,
      completed: true,
      createdAt: created.createdAt,
      dueDate: '2026-09-10T00:00:00.000Z',
    });
  });
});

describe('DELETE /tasks/:id', () => {
  it('returns 204 with an empty body, and the task no longer appears in GET /tasks (SPEC-001 #9)', async () => {
    const app = createApp();
    const created = await createTask(app, 'Buy milk');

    const res = await request(app).delete(`/tasks/${created.id}`);

    expect(res.status).toBe(204);
    expect(res.body).toEqual({});
    expect(res.text).toBe('');

    const listRes = await request(app).get('/tasks');
    expect(listRes.body).toEqual([]);
  });

  it('deletes only the targeted task, leaving others in GET /tasks', async () => {
    const app = createApp();
    const first = await createTask(app, 'First');
    const second = await createTask(app, 'Second');

    const res = await request(app).delete(`/tasks/${first.id}`);
    expect(res.status).toBe(204);

    const listRes = await request(app).get('/tasks');
    expect(listRes.body).toEqual([second]);
  });

  it('returns 404 with the standard error body for a non-existent id (SPEC-001 #10)', async () => {
    const app = createApp();

    const res = await request(app).delete('/tasks/does-not-exist');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: { message: expect.any(String) } });
  });
});

describe('GET /health (unaffected by complete/delete routes)', () => {
  it('still returns 200 {"status":"ok"}', async () => {
    const res = await request(createApp()).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('unknown routes still 404', async () => {
    const res = await request(createApp()).get('/nope');
    expect(res.status).toBe(404);
  });
});

describe('performance smoke check (POC-scale, not a load-test harness)', () => {
  // No dedicated perf-testing tool is present in poc/app's devDependencies.
  // This is an in-process timing smoke check against the in-memory store,
  // intended to catch gross regressions, not to be a rigorous benchmark.
  function p95(durations: number[]): number {
    const sorted = [...durations].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * 0.95);
    return sorted[index] ?? sorted[sorted.length - 1] ?? 0;
  }

  it('p95 latency for POST /tasks/:id/complete is under 100ms across a batch of sequential requests', async () => {
    // Seeded in-process via a directly-constructed TaskStore, not via
    // sequential supertest/HTTP requests — HTTP seeding loops caused
    // intermittent socket hang-ups under full-suite parallelism. The
    // measured requests below still go through the real HTTP layer via
    // supertest, so the latency being measured is still the full
    // POST /tasks/:id/complete request path.
    const seedStore = new TaskStore();
    const requestCount = 30;
    const ids: string[] = [];
    for (let i = 0; i < requestCount; i += 1) {
      const task = seedStore.create(`Task ${i}`);
      ids.push(task.id);
    }
    const app = createApp(seedStore);

    const completeDurations: number[] = [];
    testServer.use(app);
    for (const id of ids) {
      const start = performance.now();
      const res = await baseRequest(testServer.server).post(`/tasks/${id}/complete`);
      completeDurations.push(performance.now() - start);
      expect(res.status).toBe(200);
    }

    expect(p95(completeDurations)).toBeLessThan(100);
  });

  it('p95 latency for DELETE /tasks/:id is under 100ms across a batch of sequential requests', async () => {
    // Seeded in-process via a directly-constructed TaskStore — see rationale
    // in the POST /tasks/:id/complete perf test above.
    const seedStore = new TaskStore();
    const requestCount = 30;
    const ids: string[] = [];
    for (let i = 0; i < requestCount; i += 1) {
      const task = seedStore.create(`Task ${i}`);
      ids.push(task.id);
    }
    const app = createApp(seedStore);

    const deleteDurations: number[] = [];
    testServer.use(app);
    for (const id of ids) {
      const start = performance.now();
      const res = await baseRequest(testServer.server).delete(`/tasks/${id}`);
      deleteDurations.push(performance.now() - start);
      expect(res.status).toBe(204);
    }

    expect(p95(deleteDurations)).toBeLessThan(100);
  });
});
