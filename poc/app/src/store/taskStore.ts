import type { Task } from '../models/task.js';

/**
 * In-memory store for tasks. Data does not survive process restart.
 */
export class TaskStore {
  private readonly tasks = new Map<string, Task>();

  /**
   * Creates a new task from a (already-validated) title and an optional
   * (already-validated) dueDate. Server-generates `id` and `createdAt`;
   * `completed` always starts `false`. `dueDate` is stored verbatim, and
   * defaults to `null` if omitted. Any caller intent to set `id`,
   * `createdAt`, or `completed` directly is ignored — this method only
   * accepts a `title` and `dueDate`.
   */
  create(title: string, dueDate: string | null = null): Task {
    const task: Task = {
      id: crypto.randomUUID(),
      title,
      completed: false,
      createdAt: new Date().toISOString(),
      dueDate,
    };
    this.tasks.set(task.id, task);
    return task;
  }

  /**
   * Returns all tasks in stable insertion order.
   */
  list(): Task[] {
    return [...this.tasks.values()];
  }

  /**
   * Marks the task with the given id as completed. Idempotent — calling
   * this again on an already-completed task is a no-op that still returns
   * the task. Returns `undefined` if no task with that id exists.
   */
  complete(id: string): Task | undefined {
    const task = this.tasks.get(id);
    if (!task) {
      return undefined;
    }
    if (!task.completed) {
      task.completed = true;
    }
    return task;
  }

  /**
   * Removes the task with the given id. Returns `true` if a task was
   * removed, `false` if no task with that id existed.
   */
  remove(id: string): boolean {
    return this.tasks.delete(id);
  }

  /**
   * Returns incomplete tasks whose `dueDate` is earlier than `now`
   * (milliseconds since epoch, UTC; defaults to `Date.now()`), sorted
   * ascending by `dueDate` with `createdAt`-ascending tiebreak (matching
   * SPEC-001's stable-order convention). Tasks with `dueDate: null`,
   * completed tasks, and tasks whose `dueDate` has not yet passed are
   * excluded. `now` is exposed as a parameter for deterministic testing.
   */
  listOverdue(now: number = Date.now()): Task[] {
    return this.list()
      .filter((task) => !task.completed && task.dueDate !== null && Date.parse(task.dueDate) < now)
      .sort((a, b) => {
        const dueDateDiff = Date.parse(a.dueDate as string) - Date.parse(b.dueDate as string);
        if (dueDateDiff !== 0) {
          return dueDateDiff;
        }
        return Date.parse(a.createdAt) - Date.parse(b.createdAt);
      });
  }
}
