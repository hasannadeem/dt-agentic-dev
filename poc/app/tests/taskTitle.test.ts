import { describe, expect, it } from 'vitest';
import { validateTaskTitle } from '../src/validation/taskTitle.js';

describe('validateTaskTitle', () => {
  it('rejects a missing title (undefined)', () => {
    const result = validateTaskTitle(undefined);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBeTruthy();
    }
  });

  it('rejects a missing title (null)', () => {
    const result = validateTaskTitle(null);
    expect(result.valid).toBe(false);
  });

  it('rejects a non-string title', () => {
    const result = validateTaskTitle(42);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBeTruthy();
    }
  });

  it('rejects an empty string title', () => {
    const result = validateTaskTitle('');
    expect(result.valid).toBe(false);
  });

  it('rejects a whitespace-only title', () => {
    const result = validateTaskTitle('    ');
    expect(result.valid).toBe(false);
  });

  it('rejects a title longer than 200 characters', () => {
    const result = validateTaskTitle('a'.repeat(201));
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.reason).toBeTruthy();
    }
  });

  it('accepts a valid non-empty title at the 200 character boundary', () => {
    const title = 'a'.repeat(200);
    const result = validateTaskTitle(title);
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.title).toBe(title);
    }
  });

  it('accepts a valid title and returns it trimmed', () => {
    const result = validateTaskTitle('  Buy milk  ');
    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.title).toBe('Buy milk');
    }
  });

  it('produces distinct reasons for different rejection cases', () => {
    const missing = validateTaskTitle(undefined);
    const nonString = validateTaskTitle(42);
    const empty = validateTaskTitle('');
    const tooLong = validateTaskTitle('a'.repeat(201));

    const reasons = [missing, nonString, empty, tooLong]
      .filter((r): r is { valid: false; reason: string } => !r.valid)
      .map((r) => r.reason);

    expect(new Set(reasons).size).toBe(reasons.length);
  });
});
