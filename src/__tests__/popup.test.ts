import { describe, it, before, after, mock } from "node:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";

// ---------------------------------------------------------------------------
// Set up DOM environment BEFORE any module import that reads `document`
// ---------------------------------------------------------------------------

const window = new Window({ url: "https://localhost" });
const document = window.document;
(globalThis as any).document = document;
(globalThis as any).window = window;
(globalThis as any).HTMLInputElement = window.HTMLInputElement;
(globalThis as any).Event = window.Event;

// Build the popup DOM once — popup.ts grabs element refs at import time.
document.body.innerHTML = `
  <input id="toggle" type="checkbox" />
  <span id="status-label">Enabled</span>
  <p id="pattern-count"></p>
  <button id="options-btn" type="button">Manage Patterns</button>
`;

// ---------------------------------------------------------------------------
// Mock browser API
// ---------------------------------------------------------------------------

// Storage data that storage.local.get returns.
const storedData: Record<string, unknown> = { patterns: [], enabled: true };

const openOptionsPageMock = mock.fn();
const storageSetMock = mock.fn(async (items: Record<string, unknown>) => {
  Object.assign(storedData, items);
});

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
      set: storageSetMock,
    },
  },
  runtime: {
    id: "pristine-history-test",
    openOptionsPage: openOptionsPageMock,
  },
};
// The polyfill checks chrome.runtime.id before using the promise-based browser API.
Object.assign(globalThis, { chrome: { runtime: browser.runtime }, browser });

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const toggle = document.getElementById("toggle") as unknown as HTMLInputElement;
const label = document.getElementById("status-label")!;
const count = document.getElementById("pattern-count")!;
const optionsBtn = document.getElementById("options-btn")!;

// Import popup module — this runs refresh() which is async.
before(async () => {
  await import("../popup");
  await new Promise<void>((resolve) => setImmediate(resolve));
});

after(async () => {
  await window.close();
});

// ---------------------------------------------------------------------------
// 2.1 — Default state (tested from the initial import)
// ---------------------------------------------------------------------------
describe("2.1 default state", () => {
  it("shows enabled toggle and 0 patterns on load", () => {
    assert.equal((toggle as any).checked, true);
    assert.equal(label.textContent, "Enabled");
    assert.equal(count.textContent, "0 patterns configured");
  });
});

// ---------------------------------------------------------------------------
// 2.2 — Disable
// ---------------------------------------------------------------------------
describe("2.2 disable toggle", () => {
  it("changes label to Disabled and persists to storage", () => {
    (toggle as any).checked = false;
    toggle.dispatchEvent(new window.Event("change") as unknown as Event);

    assert.equal(label.textContent, "Disabled");
    assert.equal(storageSetMock.mock.callCount() >= 1, true);
    const calls = storageSetMock.mock.calls;
    const lastCall = calls[calls.length - 1]!;
    assert.deepEqual(lastCall.arguments[0], { enabled: false });
  });
});

// ---------------------------------------------------------------------------
// 2.3 — Re-enable
// ---------------------------------------------------------------------------
describe("2.3 re-enable toggle", () => {
  it("changes label back to Enabled", () => {
    (toggle as any).checked = true;
    toggle.dispatchEvent(new window.Event("change") as unknown as Event);

    assert.equal(label.textContent, "Enabled");
    const calls = storageSetMock.mock.calls;
    const lastCall = calls[calls.length - 1]!;
    assert.deepEqual(lastCall.arguments[0], { enabled: true });
  });
});

// ---------------------------------------------------------------------------
// 2.7 — Manage Patterns button
// ---------------------------------------------------------------------------
describe("2.7 manage patterns button", () => {
  it("calls runtime.openOptionsPage on click", () => {
    (optionsBtn as unknown as HTMLElement).click();
    assert.equal(openOptionsPageMock.mock.callCount(), 1);
  });
});
