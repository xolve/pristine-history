import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Exercises the same RegExp matching logic used by background.ts
 * and the URL tester in options.ts.
 */
function matchesAny(patterns: string[], url: string): string | null {
  for (const src of patterns) {
    if (new RegExp(src).test(url)) return src;
  }
  return null;
}

// ---------------------------------------------------------------------------
// 5.1–5.2 — URL tester: match vs no-match
// ---------------------------------------------------------------------------
describe("URL tester — basic matching", () => {
  const patterns = ["^https://example\\.com/"];

  it("5.1 returns matching pattern for a matching URL", () => {
    assert.equal(matchesAny(patterns, "https://example.com/page"), patterns[0]);
  });

  it("5.2 returns null for a non-matching URL", () => {
    assert.equal(matchesAny(patterns, "https://other.com/"), null);
  });
});

// ---------------------------------------------------------------------------
// 5.5 — Multiple patterns: first match wins
// ---------------------------------------------------------------------------
describe("URL tester — multiple patterns", () => {
  const patterns = [
    "^https://alpha\\.com/",
    "^https://beta\\.com/",
    "^https://gamma\\.com/",
  ];

  it("5.5 returns the first matching pattern", () => {
    assert.equal(matchesAny(patterns, "https://beta.com/page"), patterns[1]);
  });

  it("returns first when multiple patterns match", () => {
    const overlapping = ["beta", "^https://beta"];
    assert.equal(matchesAny(overlapping, "https://beta.com/page"), "beta");
  });
});

// ---------------------------------------------------------------------------
// 5.6 — No patterns configured
// ---------------------------------------------------------------------------
describe("URL tester — no patterns", () => {
  it("5.6 returns null when pattern list is empty", () => {
    assert.equal(matchesAny([], "https://anything.com/"), null);
  });
});

// ---------------------------------------------------------------------------
// 6.5–6.6 — Core matching scenarios
// ---------------------------------------------------------------------------
describe("core pattern matching", () => {
  it("6.5 matches URLs against different patterns", () => {
    const patterns = [
      "^https://example\\.com/",
      "^https://secret\\.org/",
      "\\.pdf$",
    ];
    assert.equal(matchesAny(patterns, "https://example.com/page"), patterns[0]);
    assert.equal(matchesAny(patterns, "https://secret.org/doc"), patterns[1]);
    assert.equal(
      matchesAny(patterns, "https://files.com/report.pdf"),
      patterns[2],
    );
    assert.equal(matchesAny(patterns, "https://safe.com/"), null);
  });

  it("6.6 partial URL match with utm_ pattern", () => {
    assert.equal(
      matchesAny(["utm_"], "https://foo.com/?utm_source=bar"),
      "utm_",
    );
  });
});

// ---------------------------------------------------------------------------
// 7.1 — Special regex characters in URL
// ---------------------------------------------------------------------------
describe("edge cases — special characters", () => {
  it("7.1 matches query string with escaped ?", () => {
    assert.equal(matchesAny(["\\?q="], "https://google.com?q=test"), "\\?q=");
  });

  it("matches URL with hash fragment", () => {
    assert.equal(
      matchesAny(["#section"], "https://example.com/page#section"),
      "#section",
    );
  });

  it("matches URL with port", () => {
    assert.equal(
      matchesAny([":8080/"], "https://localhost:8080/api"),
      ":8080/",
    );
  });
});

// ---------------------------------------------------------------------------
// 7.7 — File extension patterns
// ---------------------------------------------------------------------------
describe("edge cases — file extension patterns", () => {
  const patterns = ["\\.(pdf|docx?)$"];

  it("7.7 matches .pdf URL", () => {
    assert.equal(
      matchesAny(patterns, "https://files.com/report.pdf"),
      patterns[0],
    );
  });

  it("matches .doc URL", () => {
    assert.equal(
      matchesAny(patterns, "https://files.com/letter.doc"),
      patterns[0],
    );
  });

  it("matches .docx URL", () => {
    assert.equal(
      matchesAny(patterns, "https://files.com/letter.docx"),
      patterns[0],
    );
  });

  it("does not match .txt URL", () => {
    assert.equal(matchesAny(patterns, "https://files.com/notes.txt"), null);
  });

  it("does not match pdf in the middle of a path", () => {
    assert.equal(matchesAny(patterns, "https://files.com/pdf/page"), null);
  });
});

// ---------------------------------------------------------------------------
// README example patterns
// ---------------------------------------------------------------------------
describe("README example patterns", () => {
  it("matches all pages on example.com", () => {
    const p = ["^https://(www\\.)?example\\.com/"];
    assert.notEqual(matchesAny(p, "https://example.com/page"), null);
    assert.notEqual(matchesAny(p, "https://www.example.com/page"), null);
    assert.equal(matchesAny(p, "https://notexample.com/page"), null);
  });

  it("matches UTM tracking parameters", () => {
    const p = ["[?&]utm_"];
    assert.notEqual(
      matchesAny(p, "https://site.com/page?utm_source=google"),
      null,
    );
    assert.notEqual(
      matchesAny(p, "https://site.com/page?ref=1&utm_medium=cpc"),
      null,
    );
    assert.equal(matchesAny(p, "https://site.com/page?ref=1"), null);
  });

  it("matches Gmail", () => {
    const p = ["^https://mail\\.google\\.com/"];
    assert.notEqual(
      matchesAny(p, "https://mail.google.com/mail/u/0/"),
      null,
    );
    assert.equal(matchesAny(p, "https://google.com/mail"), null);
  });
});
