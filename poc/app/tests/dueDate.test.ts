import { describe, expect, it } from 'vitest';
import { validateDueDate } from '../src/validation/dueDate.js';

describe('validateDueDate', () => {
  it('accepts a missing dueDate (undefined) and resolves to null', () => {
    const result = validateDueDate(undefined);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.dueDate).toBeNull();
    }
  });

  it('accepts a missing dueDate (null) and resolves to null', () => {
    const result = validateDueDate(null);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.dueDate).toBeNull();
    }
  });

  it('accepts a valid ISO 8601 date string and returns it unchanged', () => {
    const result = validateDueDate('2026-09-10T00:00:00.000Z');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.dueDate).toBe('2026-09-10T00:00:00.000Z');
    }
  });

  it('accepts a dueDate in the past (no "must not be in the past" check)', () => {
    const result = validateDueDate('2000-01-01T00:00:00.000Z');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.dueDate).toBe('2000-01-01T00:00:00.000Z');
    }
  });

  it('rejects a non-string dueDate (number)', () => {
    const result = validateDueDate(42);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBeTruthy();
    }
  });

  it('rejects an empty string dueDate', () => {
    const result = validateDueDate('');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBeTruthy();
    }
  });

  it('rejects an unparseable string dueDate', () => {
    const result = validateDueDate('not-a-date');
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBeTruthy();
    }
  });

  it('produces distinct reasons for different rejection cases', () => {
    const nonString = validateDueDate(42);
    const empty = validateDueDate('');
    const unparseable = validateDueDate('not-a-date');

    const reasons = [nonString, empty, unparseable]
      .filter((r): r is { valid: false; reason: string } => !r.valid)
      .map((r) => r.reason);

    expect(new Set(reasons).size).toBe(reasons.length);
  });
});
