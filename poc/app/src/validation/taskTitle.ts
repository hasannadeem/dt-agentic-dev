export interface TitleValidationSuccess {
  valid: true;
  title: string;
}

export interface TitleValidationFailure {
  valid: false;
  reason: string;
}

export type TitleValidationResult = TitleValidationSuccess | TitleValidationFailure;

const MAX_TITLE_LENGTH = 200;

/**
 * Validates a raw, untrusted `title` value from a request body.
 *
 * Returns a trimmed, valid title on success, or a specific human-readable
 * rejection reason for: missing, non-string, empty/whitespace-only, and
 * over-length titles.
 */
export function validateTaskTitle(rawTitle: unknown): TitleValidationResult {
  if (rawTitle === undefined || rawTitle === null) {
    return { valid: false, reason: 'title is required' };
  }

  if (typeof rawTitle !== 'string') {
    return { valid: false, reason: 'title must be a string' };
  }

  const trimmed = rawTitle.trim();

  if (trimmed.length === 0) {
    return { valid: false, reason: 'title must not be empty' };
  }

  if (trimmed.length > MAX_TITLE_LENGTH) {
    return { valid: false, reason: `title must be at most ${MAX_TITLE_LENGTH} characters` };
  }

  return { valid: true, title: trimmed };
}
