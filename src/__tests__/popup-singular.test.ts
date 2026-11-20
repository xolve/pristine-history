/**
 * Test for singular pattern count display.
 * Separate file so storage has exactly 1 pattern at import time.
 */
import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

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

const browser = {
  storage: {
    local: {
      get: mock.fn(async () => ({ patterns: ["abc"], enabled: true })),
      set: mock.fn(async () => {}),
    },
  },
  runtime: {
    id: "pristine-history-test",
    openOptionsPage: mock.fn(),
  },
};
Object.assign(globalThis, { chrome: { runtime: browser.runtime }, browser });

const count = document.getElementById("pattern-count")!;

before(async () => {
  await import("../popup");
  await new Promise<void>((resolve) => setImmediate(resolve));
});

after(async () => {
  await window.close();
});

// 2.6 — Singular pattern count
describe("2.6 singular pattern count", () => {
  it('shows "1 pattern configured" without trailing s', () => {
    assert.equal(count.textContent, "1 pattern configured");
  });
});
