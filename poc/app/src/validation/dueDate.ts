export interface DueDateValidationSuccess {
  valid: true;
  dueDate: string | null;
}

export interface DueDateValidationFailure {
  valid: false;
  reason: string;
}

export type DueDateValidationResult = DueDateValidationSuccess | DueDateValidationFailure;

/**
 * Validates a raw, untrusted `dueDate` value from a request body.
 *
 * `undefined`/`null` (i.e. absent) is valid and resolves to `null`. A string
 * that parses as a valid date (per the spec's ISO 8601 UTC convention, e.g.
 * `2026-09-10T00:00:00.000Z`) is valid and resolves to the string as given —
 * no reformatting. Anything else (non-string, empty string, unparseable
 * string, number, etc.) is rejected with a specific human-readable reason.
 *
 * No "must not be in the past" check — per spec, past dates are allowed at
 * creation.
 */
export function validateDueDate(rawDueDate: unknown): DueDateValidationResult {
  if (rawDueDate === undefined || rawDueDate === null) {
    return { valid: true, dueDate: null };
  }

  if (typeof rawDueDate !== 'string') {
    return { valid: false, reason: 'dueDate must be a string' };
  }

  if (rawDueDate.trim().length === 0) {
    return { valid: false, reason: 'dueDate must not be empty' };
  }

  if (Number.isNaN(Date.parse(rawDueDate))) {
    return { valid: false, reason: 'dueDate must be a valid ISO 8601 date string' };
  }

  return { valid: true, dueDate: rawDueDate };
}
