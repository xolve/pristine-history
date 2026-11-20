import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  validatePattern,
  MAX_PATTERN_LENGTH,
  MAX_PATTERN_COUNT,
} from "../regex-validator";

// ---------------------------------------------------------------------------
// 3.4 — Empty pattern
// ---------------------------------------------------------------------------
describe("empty / blank patterns", () => {
  it("rejects an empty string", () => {
    const r = validatePattern("");
    assert.equal(r.valid, false);
    assert.match(r.error!, /empty/i);
  });

  it("rejects a whitespace-only string", () => {
    const r = validatePattern("   ");
    assert.equal(r.valid, false);
    assert.match(r.error!, /empty/i);
  });

  it("rejects a non-string value", () => {
    const r = validatePattern(42 as unknown as string);
    assert.equal(r.valid, false);
    assert.match(r.error!, /string/i);
  });
});

// ---------------------------------------------------------------------------
// 3.6 — Invalid regex syntax
// ---------------------------------------------------------------------------
describe("invalid regex syntax", () => {
  it("rejects an unclosed character class", () => {
    const r = validatePattern("[unclosed");
    assert.equal(r.valid, false);
    assert.match(r.error!, /invalid regex/i);
  });

  it("rejects an unclosed group", () => {
    const r = validatePattern("(abc");
    assert.equal(r.valid, false);
    assert.match(r.error!, /invalid regex/i);
  });

  it("rejects a lone trailing backslash", () => {
    const r = validatePattern("abc\\");
    assert.equal(r.valid, false);
    assert.match(r.error!, /invalid regex/i);
  });
});

// ---------------------------------------------------------------------------
// 3.7 — Pattern length limit
// ---------------------------------------------------------------------------
describe("pattern length limit", () => {
  it("rejects a pattern exceeding MAX_PATTERN_LENGTH", () => {
    const long = "a".repeat(MAX_PATTERN_LENGTH + 1);
    const r = validatePattern(long);
    assert.equal(r.valid, false);
    assert.match(r.error!, /maximum length/i);
  });

  it("accepts a pattern at exactly MAX_PATTERN_LENGTH", () => {
    const exact = "a".repeat(MAX_PATTERN_LENGTH);
    const r = validatePattern(exact);
    assert.equal(r.valid, true);
  });
});

// ---------------------------------------------------------------------------
// 3.8 — MAX_PATTERN_COUNT constant
// ---------------------------------------------------------------------------
describe("MAX_PATTERN_COUNT constant", () => {
  it("equals 50", () => {
    assert.equal(MAX_PATTERN_COUNT, 50);
  });
});

// ---------------------------------------------------------------------------
// 4.1–4.5 — ReDoS: dangerous constructs rejected
// ---------------------------------------------------------------------------
describe("ReDoS — dangerous constructs", () => {
  it("4.1 rejects nested quantifier (a+)+", () => {
    const r = validatePattern("(a+)+");
    assert.equal(r.valid, false);
    assert.match(r.error!, /catastrophic backtracking/i);
  });

  it("4.2 rejects nested quantifier (a*)*", () => {
    const r = validatePattern("(a*)*");
    assert.equal(r.valid, false);
    assert.match(r.error!, /catastrophic backtracking/i);
  });

  it("4.3 rejects inner braces + outer star (a{2,})*", () => {
    const r = validatePattern("(a{2,})*");
    assert.equal(r.valid, false);
    assert.match(r.error!, /catastrophic backtracking/i);
  });

  it("4.3b rejects inner star + outer braces (a*){2,}", () => {
    const r = validatePattern("(a*){2,}");
    assert.equal(r.valid, false);
    assert.match(r.error!, /catastrophic backtracking/i);
  });

  it("4.3c rejects inner braces + outer braces (a{2,}){3,}", () => {
    const r = validatePattern("(a{2,}){3,}");
    assert.equal(r.valid, false);
    assert.match(r.error!, /catastrophic backtracking/i);
  });

  it("4.3d rejects inner plus + outer braces (a+){2,}", () => {
    const r = validatePattern("(a+){2,}");
    assert.equal(r.valid, false);
    assert.match(r.error!, /catastrophic backtracking/i);
  });

  it("4.4 rejects overlapping alternation (.*|.*)+", () => {
    const r = validatePattern("(.*|.*)+");
    assert.equal(r.valid, false);
    assert.match(r.error!, /catastrophic backtracking/i);
  });

  it("4.5 rejects backreference (.)\\1", () => {
    const r = validatePattern("(.)\\1");
    assert.equal(r.valid, false);
    assert.match(r.error!, /catastrophic backtracking/i);
  });

  it("rejects named and forward backreferences", () => {
    for (const pattern of [String.raw`(?<letter>.)\k<letter>`, String.raw`\1(.)`]) {
      const r = validatePattern(pattern);
      assert.equal(r.valid, false);
      assert.match(r.error!, /backreference/i);
    }
  });

  it("doesn't mistake literal escapes for backreferences", () => {
    for (const pattern of [String.raw`(.)\\1`, String.raw`(.)[\1]`, String.raw`(.)\141`, String.raw`(?<=.)\1`]) {
      assert.equal(validatePattern(pattern).valid, true, pattern);
    }
  });
});

// ---------------------------------------------------------------------------
// 4.6–4.7 — ReDoS: safe constructs accepted
// ---------------------------------------------------------------------------
describe("ReDoS — safe constructs", () => {
  it("4.6 accepts safe quantifier (abc)+", () => {
    const r = validatePattern("(abc)+");
    assert.equal(r.valid, true);
  });

  it("4.7 accepts safe complex pattern ^https?://.*\\.pdf$", () => {
    const r = validatePattern("^https?://.*\\.pdf$");
    assert.equal(r.valid, true);
  });

  it("accepts a simple literal pattern", () => {
    const r = validatePattern("example\\.com");
    assert.equal(r.valid, true);
  });

  it("accepts character class with quantifier [a-z]+", () => {
    const r = validatePattern("[a-z]+");
    assert.equal(r.valid, true);
  });

  it("accepts alternation without dangerous quantifier (foo|bar)", () => {
    const r = validatePattern("(foo|bar)");
    assert.equal(r.valid, true);
  });
});
