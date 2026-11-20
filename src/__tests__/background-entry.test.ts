import { it, mock } from "node:test";
import assert from "node:assert/strict";
import type { BackgroundService } from "../background";

it("wires browser events through the background entry point", async () => {
  let visit!: Parameters<BackgroundService["history"]["onVisited"]["addListener"]>[0];
  let changed!: Parameters<BackgroundService["storage"]["onChanged"]["addListener"]>[0];
  const deleteUrl = mock.fn(async (_details: { url: string }) => {});
  const browser = {
    runtime: { id: "pristine-history-test" },
    history: {
      deleteUrl,
      onVisited: { addListener: (listener: typeof visit) => { visit = listener; } },
    },
    storage: {
      local: { get: async () => ({ patterns: ["example\\.com"], enabled: true }) },
      onChanged: { addListener: (listener: typeof changed) => { changed = listener; } },
    },
  };

  // The polyfill checks chrome.runtime.id even when a native browser API exists.
  const globals = globalThis as typeof globalThis & {
    chrome?: unknown;
    browser?: unknown;
  };
  const previousChrome = globals.chrome;
  const previousBrowser = globals.browser;
  globals.chrome = { runtime: browser.runtime };
  globals.browser = browser;
  try {
    await import("../background");
    await new Promise<void>((resolve) => setImmediate(resolve));
    visit({ url: "https://example.com/" });
    await new Promise<void>((resolve) => setImmediate(resolve));
    assert.equal(deleteUrl.mock.callCount(), 1);

    changed({ enabled: { newValue: false } }, "local");
    visit({ url: "https://example.com/" });
    assert.equal(deleteUrl.mock.callCount(), 1);
  } finally {
    if (previousChrome === undefined) delete globals.chrome;
    else globals.chrome = previousChrome;
    if (previousBrowser === undefined) delete globals.browser;
    else globals.browser = previousBrowser;
  }
});
