import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

// Fixed, deterministic ISO 8601 UTC strings — always in the past/future
// relative to any real wall-clock time this suite will ever run at, so
// there is no reliance on Date.now() timing or sleeping between requests.
const PAST_1 = '2020-01-01T00:00:00.000Z';
const PAST_2 = '2020-06-01T00:00:00.000Z';
const PAST_3 = '2021-01-01T00:00:00.000Z';
const FUTURE = '2099-01-01T00:00:00.000Z';

type TaskBody = {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  dueDate: string | null;
};

async function createTask(
  app: ReturnType<typeof createApp>,
  title: string,
  dueDate?: string | null,
): Promise<TaskBody> {
  const res = await request(app)
    .post('/tasks')
    .send(dueDate === undefined ? { title } : { title, dueDate });
  return res.body as TaskBody;
}

describe('GET /tasks/overdue', () => {
  it('returns 200 with [] on an empty store (SPEC-002 #6)', async () => {
    const res = await request(createApp()).get('/tasks/overdue');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toEqual([]);
  });

  it('returns 200 with [] when tasks exist but none are overdue (only future-dated and null-dueDate tasks) (SPEC-002 #6)', async () => {
    const app = createApp();
    await createTask(app, 'No due date');
    await createTask(app, 'Due in the future', FUTURE);

    const res = await request(app).get('/tasks/overdue');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  it('excludes an incomplete task with dueDate: null (SPEC-002 #7)', async () => {
    const app = createApp();
    await createTask(app, 'No due date');
    const overdue = await createTask(app, 'Overdue', PAST_1);

    const res = await request(app).get('/tasks/overdue');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(overdue.id);
  });

  it('excludes a task with a past dueDate that has been completed (SPEC-002 #8)', async () => {
    const app = createApp();
    const completed = await createTask(app, 'Completed overdue', PAST_1);
    await request(app).post(`/tasks/${completed.id}/complete`);
    const stillOverdue = await createTask(app, 'Still overdue', PAST_2);

    const res = await request(app).get('/tasks/overdue');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(stillOverdue.id);
  });

  it('excludes a task with a future dueDate (SPEC-002 #9)', async () => {
    const app = createApp();
    await createTask(app, 'Not yet due', FUTURE);
    const overdue = await createTask(app, 'Overdue', PAST_1);

    const res = await request(app).get('/tasks/overdue');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].id).toBe(overdue.id);
  });

  it('includes every incomplete task whose dueDate is earlier than the current server time (SPEC-002 #10)', async () => {
    const app = createApp();
    const first = await createTask(app, 'First overdue', PAST_1);
    const second = await createTask(app, 'Second overdue', PAST_2);
    await createTask(app, 'Not due yet', FUTURE);
    await createTask(app, 'No due date');

    const res = await request(app).get('/tasks/overdue');

    expect(res.status).toBe(200);
    const ids = (res.body as TaskBody[]).map((t) => t.id);
    expect(ids).toEqual(expect.arrayContaining([first.id, second.id]));
    expect(ids).toHaveLength(2);
  });

  it('orders three overdue tasks with distinct due dates T1 < T2 < T3 as [T1, T2, T3] (SPEC-002 #11)', async () => {
    const app = createApp();
    // Created out of due-date order to prove sorting is by dueDate, not insertion order.
    const t3 = await createTask(app, 'T3', PAST_3);
    const t1 = await createTask(app, 'T1', PAST_1);
    const t2 = await createTask(app, 'T2', PAST_2);

    const res = await request(app).get('/tasks/overdue');

    expect(res.status).toBe(200);
    expect((res.body as TaskBody[]).map((t) => t.id)).toEqual([t1.id, t2.id, t3.id]);
  });

  it('orders two overdue tasks with an identical dueDate by createdAt ascending (SPEC-002 #12)', async () => {
    const app = createApp();
    const createdFirst = await createTask(app, 'Created first', PAST_1);
    const createdSecond = await createTask(app, 'Created second', PAST_1);

    const res = await request(app).get('/tasks/overdue');

    expect(res.status).toBe(200);
    expect((res.body as TaskBody[]).map((t) => t.id)).toEqual([createdFirst.id, createdSecond.id]);
  });

  it('no longer includes a task after it is completed via POST /tasks/:id/complete (SPEC-002 #13)', async () => {
    const app = createApp();
    const overdue = await createTask(app, 'Overdue', PAST_1);

    const before = await request(app).get('/tasks/overdue');
    expect(before.body).toHaveLength(1);

    const completeRes = await request(app).post(`/tasks/${overdue.id}/complete`);
    expect(completeRes.status).toBe(200);

    const after = await request(app).get('/tasks/overdue');
    expect(after.status).toBe(200);
    expect(after.body).toEqual([]);
  });

  it('returns items with the identical field shape to GET /tasks items (SPEC-002 #14)', async () => {
    const app = createApp();
    await createTask(app, 'Overdue', PAST_1);

    const overdueRes = await request(app).get('/tasks/overdue');
    const listRes = await request(app).get('/tasks');

    expect(overdueRes.status).toBe(200);
    expect(listRes.status).toBe(200);
    expect(overdueRes.body).toHaveLength(1);
    expect(listRes.body).toHaveLength(1);
    expect(overdueRes.body[0]).toEqual(listRes.body[0]);
    expect(Object.keys(overdueRes.body[0]).sort()).toEqual(
      ['completed', 'createdAt', 'dueDate', 'id', 'title'].sort(),
    );
  });
});

describe('GET /tasks/overdue — route registration (does not collide with /tasks/:id patterns)', () => {
  it('POST /tasks/overdue/complete (an :id of "overdue") 404s as an unknown task, not a route conflict', async () => {
    const res = await request(createApp()).post('/tasks/overdue/complete');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: expect.any(String) } });
  });

  it('DELETE /tasks/overdue (an :id of "overdue") 404s as an unknown task, not a route conflict', async () => {
    const res = await request(createApp()).delete('/tasks/overdue');

    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { message: expect.any(String) } });
  });
});

describe('SPEC-001 + TASK-002.1 regression check, with GET /tasks/overdue added (SPEC-002 #15)', () => {
  it('full lifecycle — create (with/without dueDate), list, complete, delete, and overdue — remain mutually consistent', async () => {
    const app = createApp();

    const noDueDate = await createTask(app, 'No due date');
    const overdue = await createTask(app, 'Overdue task', PAST_1);
    const future = await createTask(app, 'Future task', FUTURE);

    expect(noDueDate.dueDate).toBeNull();
    expect(overdue.dueDate).toBe(PAST_1);
    expect(future.dueDate).toBe(FUTURE);

    const listRes = await request(app).get('/tasks');
    expect(listRes.status).toBe(200);
    expect(listRes.body).toHaveLength(3);

    const overdueRes = await request(app).get('/tasks/overdue');
    expect(overdueRes.status).toBe(200);
    expect((overdueRes.body as TaskBody[]).map((t) => t.id)).toEqual([overdue.id]);

    const completeRes = await request(app).post(`/tasks/${overdue.id}/complete`);
    expect(completeRes.status).toBe(200);
    expect(completeRes.body.completed).toBe(true);
    expect(completeRes.body.dueDate).toBe(PAST_1);

    const overdueAfterComplete = await request(app).get('/tasks/overdue');
    expect(overdueAfterComplete.body).toEqual([]);

    const deleteRes = await request(app).delete(`/tasks/${future.id}`);
    expect(deleteRes.status).toBe(204);

    const finalList = await request(app).get('/tasks');
    expect(finalList.body).toHaveLength(2);
    expect((finalList.body as TaskBody[]).map((t) => t.id).sort()).toEqual(
      [noDueDate.id, overdue.id].sort(),
    );

    const finalOverdue = await request(app).get('/tasks/overdue');
    expect(finalOverdue.body).toEqual([]);
  });
});

describe('GET /health (unaffected by the overdue route)', () => {
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

  it('p95 latency for GET /tasks/overdue is under 150ms with up to 1,000 tasks seeded, sampled at a rate consistent with 20 requests/sec (SPEC-002 #16)', async () => {
    const app = createApp();
    const seedCount = 1000;
    for (let i = 0; i < seedCount; i += 1) {
      const dueDate = i % 2 === 0 ? PAST_1 : FUTURE;
      await request(app)
        .post('/tasks')
        .send({ title: `Task ${i}`, dueDate });
    }

    const requestCount = 20;
    const overdueDurations: number[] = [];
    for (let i = 0; i < requestCount; i += 1) {
      const start = performance.now();
      const res = await request(app).get('/tasks/overdue');
      overdueDurations.push(performance.now() - start);
      expect(res.status).toBe(200);
    }

    expect(p95(overdueDurations)).toBeLessThan(150);
  });
});
