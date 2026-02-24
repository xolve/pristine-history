export const MAX_PATTERN_LENGTH = 500;
export const MAX_PATTERN_COUNT = 50;

import safeRegex from 'safe-regex';

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export function validatePattern(pattern: string): ValidationResult {
  if (typeof pattern !== "string") {
    return { valid: false, error: "Pattern must be a string." };
  }

  const trimmed = pattern.trim();
  if (trimmed.length === 0) {
    return { valid: false, error: "Pattern cannot be empty." };
  }

  if (trimmed.length > MAX_PATTERN_LENGTH) {
    return {
      valid: false,
      error: `Pattern exceeds maximum length of ${MAX_PATTERN_LENGTH} characters.`,
    };
  }

  if (!safeRegex(trimmed)) {
    return { valid: false, error: "Pattern is potentially unsafe (catastrophic backtracking)." };
  }

  try {
    new RegExp(trimmed);
  } catch (e) {
    return { valid: false, error: `Invalid regex: ${(e as Error).message}` };
  }

  return { valid: true };
}
