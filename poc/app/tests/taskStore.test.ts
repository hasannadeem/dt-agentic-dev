import { describe, expect, it } from 'vitest';
import { TaskStore } from '../src/store/taskStore.js';

describe('TaskStore', () => {
  describe('create', () => {
    it('server-generates id and createdAt, and returns completed: false', () => {
      const store = new TaskStore();
      const task = store.create('Buy milk');

      expect(typeof task.id).toBe('string');
      expect(task.id.length).toBeGreaterThan(0);
      expect(task.title).toBe('Buy milk');
      expect(task.completed).toBe(false);
      expect(typeof task.createdAt).toBe('string');
      expect(new Date(task.createdAt).toISOString()).toBe(task.createdAt);
    });

    it('generates a distinct id for each created task', () => {
      const store = new TaskStore();
      const first = store.create('Task one');
      const second = store.create('Task two');

      expect(first.id).not.toBe(second.id);
    });

    it('defaults dueDate to null when omitted', () => {
      const store = new TaskStore();
      const task = store.create('Buy milk');

      expect(task.dueDate).toBeNull();
    });

    it('stores a given dueDate verbatim', () => {
      const store = new TaskStore();
      const task = store.create('Pay rent', '2026-09-10T00:00:00.000Z');

      expect(task.dueDate).toBe('2026-09-10T00:00:00.000Z');
    });
  });

  describe('list', () => {
    it('returns [] on an empty store', () => {
      const store = new TaskStore();
      expect(store.list()).toEqual([]);
    });

    it('returns all created tasks in insertion order', () => {
      const store = new TaskStore();
      const first = store.create('First');
      const second = store.create('Second');
      const third = store.create('Third');

      expect(store.list()).toEqual([first, second, third]);
    });
  });

  describe('complete', () => {
    it('marks an existing, incomplete task as completed and preserves other fields', () => {
      const store = new TaskStore();
      const created = store.create('Buy milk');
      const before = { ...created };

      const completed = store.complete(created.id);

      expect(completed).toBeDefined();
      expect(completed?.completed).toBe(true);
      expect(completed?.id).toBe(before.id);
      expect(completed?.title).toBe(before.title);
      expect(completed?.createdAt).toBe(before.createdAt);
    });

    it('is idempotent when called again on an already-completed task', () => {
      const store = new TaskStore();
      const created = store.create('Buy milk');
      store.complete(created.id);
      const before = { ...created };

      const completedAgain = store.complete(created.id);

      expect(completedAgain).toBeDefined();
      expect(completedAgain?.completed).toBe(true);
      expect(completedAgain?.id).toBe(before.id);
      expect(completedAgain?.title).toBe(before.title);
      expect(completedAgain?.createdAt).toBe(before.createdAt);
    });

    it('returns undefined for an unknown id', () => {
      const store = new TaskStore();
      expect(store.complete('unknown-id')).toBeUndefined();
    });

    it('leaves dueDate unchanged when completing a task', () => {
      const store = new TaskStore();
      const created = store.create('Pay rent', '2026-09-10T00:00:00.000Z');

      const completed = store.complete(created.id);

      expect(completed?.dueDate).toBe('2026-09-10T00:00:00.000Z');
    });
  });

  describe('listOverdue', () => {
    it('excludes a task whose dueDate is exactly equal to `now` (not overdue yet), and includes it one millisecond later (pins the < operator)', () => {
      const store = new TaskStore();
      const exactEpoch = Date.parse('2020-01-01T00:00:00.000Z');
      const task = store.create('Due right at now', '2020-01-01T00:00:00.000Z');

      expect(store.listOverdue(exactEpoch)).toEqual([]);
      expect(store.listOverdue(exactEpoch + 1)).toEqual([task]);
    });

    it('orders tasks with an identical dueDate by createdAt ascending, even when createdAt order is inverted relative to insertion order (pins the tiebreak, kills return-0 mutation)', () => {
      const store = new TaskStore();
      const insertedFirst = store.create('Inserted first', '2020-01-01T00:00:00.000Z');
      const insertedSecond = store.create('Inserted second', '2020-01-01T00:00:00.000Z');

      // TaskStore hands out live references, so mutating the returned
      // objects mutates the stored tasks directly. Force createdAt order to
      // invert insertion order, so a comparator that (incorrectly) falls
      // back to insertion/stable order instead of comparing createdAt would
      // be caught here.
      insertedFirst.createdAt = '2020-01-02T00:00:00.000Z';
      insertedSecond.createdAt = '2020-01-01T00:00:00.000Z';

      const result = store.listOverdue(Date.parse('2021-01-01T00:00:00.000Z'));

      expect(result.map((t) => t.id)).toEqual([insertedSecond.id, insertedFirst.id]);
    });
  });

  describe('remove', () => {
    it('removes an existing task and excludes it from subsequent list()', () => {
      const store = new TaskStore();
      const first = store.create('First');
      const second = store.create('Second');

      const result = store.remove(first.id);

      expect(result).toBe(true);
      expect(store.list()).toEqual([second]);
    });

    it('returns false for an unknown id', () => {
      const store = new TaskStore();
      expect(store.remove('unknown-id')).toBe(false);
    });
  });
});
