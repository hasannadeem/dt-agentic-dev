export interface DueDateValidationSuccess {
  valid: true;
  dueDate: string | null;
}

export interface DueDateValidationFailure {
  valid: false;
  reason: string;
}

export type DueDateValidationResult = DueDateValidationSuccess | DueDateValidationFailure;

// Strict ISO 8601 UTC timestamp: explicit 'Z' suffix required (no bare dates,
// no timezone-less timestamps, no numeric offsets like +05:30); milliseconds
// are optional (1-3 digits). Per SPEC-002's pinned dueDate grammar.
const ISO_8601_UTC_REGEX = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})(?:\.(\d{1,3}))?Z$/;

/**
 * Normalizes the fractional-seconds part of an already-regex-validated ISO
 * 8601 UTC string to exactly 3 digits, so that `"...T00:00:00Z"` and
 * `"...T00:00:00.000Z"` normalize to the same value for comparison against
 * `Date`'s own `toISOString()` output.
 */
function normalizeMilliseconds(match: RegExpMatchArray): string {
  const [, datePart, timePart, msPart] = match;
  const ms = (msPart ?? '').padEnd(3, '0');
  return `${datePart}T${timePart}.${ms}Z`;
}

/**
 * Validates a raw, untrusted `dueDate` value from a request body.
 *
 * `undefined`/`null` (i.e. absent, including explicit JSON `null`) is valid
 * and resolves to `null`. A string is valid only if it matches the strict
 * ISO 8601 UTC grammar (`YYYY-MM-DDTHH:mm:ss[.SSS]Z`, explicit `Z` suffix,
 * milliseconds optional) AND represents a real calendar datetime — verified
 * by comparing `new Date(s).toISOString()` against the input normalized to
 * 3-digit milliseconds, which also rejects rolled-over dates like
 * `2026-02-30`. On success, resolves to the string as given (no
 * reformatting). Anything else (non-string, empty string, bare dates,
 * timezone-less timestamps, numeric offsets, locale strings, unparseable
 * strings, numbers, etc.) is rejected with a specific human-readable reason.
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

  const match = rawDueDate.match(ISO_8601_UTC_REGEX);
  if (!match) {
    return {
      valid: false,
      reason:
        'dueDate must be an ISO 8601 UTC timestamp with a Z suffix (e.g. "2026-09-10T00:00:00.000Z")',
    };
  }

  const parsed = new Date(rawDueDate);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString() !== normalizeMilliseconds(match)) {
    return { valid: false, reason: 'dueDate must be a real calendar date' };
  }

  return { valid: true, dueDate: rawDueDate };
}
