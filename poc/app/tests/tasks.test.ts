import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

function expectTaskShape(body: unknown, title: string): void {
  const task = body as { id: unknown; title: unknown; completed: unknown; createdAt: unknown };
  expect(typeof task.id).toBe('string');
  expect(task.title).toBe(title);
  expect(task.completed).toBe(false);
  expect(typeof task.createdAt).toBe('string');
  expect(new Date(task.createdAt as string).toISOString()).toBe(task.createdAt);
}

describe('POST /tasks', () => {
  it('creates a task and returns 201 with the created task body', async () => {
    const res = await request(createApp()).post('/tasks').send({ title: 'Buy milk' });

    expect(res.status).toBe(201);
    expectTaskShape(res.body, 'Buy milk');
  });

  it('returns 400 with the standard error body when title is missing', async () => {
    const app = createApp();
    const res = await request(app).post('/tasks').send({});

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: { message: expect.any(String) } });

    const listRes = await request(app).get('/tasks');
    expect(listRes.body).toEqual([]);
  });

  it('returns 400 when title is an empty string', async () => {
    const app = createApp();
    const res = await request(app).post('/tasks').send({ title: '' });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: { message: expect.any(String) } });

    const listRes = await request(app).get('/tasks');
    expect(listRes.body).toEqual([]);
  });

  it('returns 400 when title is not a string', async () => {
    const app = createApp();
    const res = await request(app).post('/tasks').send({ title: 42 });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: { message: expect.any(String) } });

    const listRes = await request(app).get('/tasks');
    expect(listRes.body).toEqual([]);
  });

  it('returns 400 when title is longer than 200 characters', async () => {
    const app = createApp();
    const res = await request(app)
      .post('/tasks')
      .send({ title: 'a'.repeat(201) });

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: { message: expect.any(String) } });

    const listRes = await request(app).get('/tasks');
    expect(listRes.body).toEqual([]);
  });

  it('returns 400 with the standard error body for a malformed JSON body (not a 500)', async () => {
    const res = await request(createApp())
      .post('/tasks')
      .set('Content-Type', 'application/json')
      .send('{"title": "Buy milk"');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: { message: expect.any(String) } });
  });

  it('returns 413 with the standard error body for a body over express.json()\'s size limit (not an HTML 413)', async () => {
    // express.json()'s default limit is 100kb; send a JSON body comfortably over that.
    const oversizedTitle = 'a'.repeat(200 * 1024);
    const res = await request(createApp())
      .post('/tasks')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ title: oversizedTitle }));

    expect(res.status).toBe(413);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual({ error: { message: expect.any(String) } });
  });
});

describe('GET /tasks', () => {
  it('returns 200 with [] on an empty store', async () => {
    const res = await request(createApp()).get('/tasks');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('returns 200 with all created tasks, in order, after creating N (N >= 2) tasks', async () => {
    const app = createApp();
    await request(app).post('/tasks').send({ title: 'First' });
    await request(app).post('/tasks').send({ title: 'Second' });
    await request(app).post('/tasks').send({ title: 'Third' });

    const res = await request(app).get('/tasks');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(3);
    expect(res.body.map((t: { title: string }) => t.title)).toEqual(['First', 'Second', 'Third']);
    const expectedTitles = ['First', 'Second', 'Third'];
    for (const [i, task] of (res.body as unknown[]).entries()) {
      expectTaskShape(task, expectedTitles[i] as string);
    }
  });
});

describe('GET /health (unaffected by task routes)', () => {
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

  it('p95 latency for POST /tasks is under 100ms across a batch of sequential requests', async () => {
    const app = createApp();
    const requestCount = 30;
    const postDurations: number[] = [];

    for (let i = 0; i < requestCount; i += 1) {
      const start = performance.now();
      await request(app).post('/tasks').send({ title: `Task ${i}` });
      postDurations.push(performance.now() - start);
    }

    expect(p95(postDurations)).toBeLessThan(100);
  });

  it('p95 latency for GET /tasks is under 100ms across a batch of sequential requests', async () => {
    const app = createApp();
    const requestCount = 30;

    for (let i = 0; i < requestCount; i += 1) {
      await request(app).post('/tasks').send({ title: `Task ${i}` });
    }

    const getDurations: number[] = [];
    for (let i = 0; i < requestCount; i += 1) {
      const start = performance.now();
      await request(app).get('/tasks');
      getDurations.push(performance.now() - start);
    }

    expect(p95(getDurations)).toBeLessThan(100);
  });
});
