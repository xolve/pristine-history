/**
 * Tests for popup refresh() reading from storage.
 * Each test uses a separate file import with different storage state.
 * We test persistence / pattern counts here by setting storedData
 * before the module import.
 */
import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

// ---------------------------------------------------------------------------
// DOM + mock setup
// ---------------------------------------------------------------------------

const window = new Window({ url: "https://localhost" });
const document = window.document;
(globalThis as any).document = document;
(globalThis as any).window = window;
(globalThis as any).HTMLInputElement = window.HTMLInputElement;

document.body.innerHTML = `
  <input id="toggle" type="checkbox" />
  <span id="status-label">Enabled</span>
  <p id="pattern-count"></p>
  <button id="options-btn" type="button">Manage Patterns</button>
`;

// Start with disabled + 3 patterns to test initial load state.
const storedData: Record<string, unknown> = {
  patterns: ["a", "b", "c"],
  enabled: false,
};

const browser = {
  storage: {
    local: {
      get: mock.fn(async (defaults: Record<string, unknown>) => {
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(defaults)) {
          result[key] = key in storedData ? storedData[key] : defaults[key];
        }
        return result;
      }),
      set: mock.fn(async () => {}),
    },
  },
  runtime: {
    id: "pristine-history-test",
    openOptionsPage: mock.fn(),
  },
};
Object.assign(globalThis, { chrome: { runtime: browser.runtime }, browser });

const toggle = document.getElementById("toggle") as unknown as HTMLInputElement;
const label = document.getElementById("status-label")!;
const count = document.getElementById("pattern-count")!;

before(async () => {
  await import("../popup");
  await new Promise<void>((resolve) => setImmediate(resolve));
});

after(async () => {
  await window.close();
});

// ---------------------------------------------------------------------------
// 2.4 — Persistence (loads disabled state)
// ---------------------------------------------------------------------------
describe("2.4 persistence", () => {
  it("loads disabled state from storage", () => {
    assert.equal((toggle as any).checked, false);
    assert.equal(label.textContent, "Disabled");
  });
});

// ---------------------------------------------------------------------------
// 2.5 — Pattern count (plural)
// ---------------------------------------------------------------------------
describe("2.5 pattern count", () => {
  it("shows correct plural count", () => {
    assert.equal(count.textContent, "3 patterns configured");
  });
});
