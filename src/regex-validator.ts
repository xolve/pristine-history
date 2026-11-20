import safeRegex from "safe-regex";

export const MAX_PATTERN_LENGTH = 500;
export const MAX_PATTERN_COUNT = 50;

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

function hasBackreference(pattern: string): boolean {
  let inClass = false;
  let captures = 0;
  let lowestReference = Infinity;
  let hasNamedCapture = false;
  let hasNamedEscape = false;

  for (let i = 0; i < pattern.length; i++) {
    const token = pattern[i];
    if (token === "\\") {
      const escaped = pattern[++i];
      if (inClass) continue;
      if (escaped === "k" && pattern[i + 1] === "<") hasNamedEscape = true;
      const reference = /^[1-9]\d*/.exec(pattern.slice(i));
      if (reference) lowestReference = Math.min(lowestReference, Number(reference[0]));
    } else if (token === "[") {
      inClass = true;
    } else if (token === "]") {
      inClass = false;
    } else if (!inClass && token === "(") {
      const named = pattern.startsWith("(?<", i) &&
        pattern[i + 3] !== "=" && pattern[i + 3] !== "!";
      if (named || pattern[i + 1] !== "?") captures++;
      hasNamedCapture ||= named;
    }
  }

  // Without a corresponding capture, these escapes may be legacy literals.
  return lowestReference <= captures || (hasNamedEscape && hasNamedCapture);
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

  let regex: RegExp;
  try {
    regex = new RegExp(trimmed);
  } catch (e) {
    return { valid: false, error: `Invalid regex: ${(e as Error).message}` };
  }

  if (hasBackreference(trimmed)) {
    return { valid: false, error: "Backreferences are not allowed (potential catastrophic backtracking)." };
  }

  if (!safeRegex(regex)) {
    return { valid: false, error: "Pattern is potentially unsafe (catastrophic backtracking)." };
  }

  return { valid: true };
}
