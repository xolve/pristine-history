import { before, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import type { BackgroundService } from "../background";

let startBackground: typeof import("../background").startBackground;

before(async () => {
  // Importing the entry point starts a background instance. Give that instance
  // inert browser APIs; individual tests inject their own APIs below.
  const browser = {
    runtime: { id: "pristine-history-test" },
    history: {
      deleteUrl: async () => {},
      onVisited: { addListener: () => {} },
    },
    storage: {
      local: { get: async () => ({ patterns: [], enabled: true }) },
      onChanged: { addListener: () => {} },
    },
  };
  const globals = globalThis as typeof globalThis & {
    chrome?: unknown;
    browser?: unknown;
  };
  const previousChrome = globals.chrome;
  const previousBrowser = globals.browser;
  globals.chrome = { runtime: browser.runtime };
  globals.browser = browser;
  try {
    ({ startBackground } = await import("../background"));
  } finally {
    if (previousChrome === undefined) delete globals.chrome;
    else globals.chrome = previousChrome;
    if (previousBrowser === undefined) delete globals.browser;
    else globals.browser = previousBrowser;
  }
});

const PATTERN = "^https://example\\.com/";
const URL = "https://example.com/page";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function flush(): Promise<void> {
  // Flush promise continuations, not wall-clock delays.
  await new Promise<void>((resolve) => setImmediate(resolve));
}

function setup(
  initial: Promise<Record<string, unknown>> = Promise.resolve({ patterns: [PATTERN], enabled: true }),
  remove: (details: { url: string }) => Promise<unknown> = async () => {},
) {
  let visit!: (result: { url?: string }) => void;
  let changed!: Parameters<BackgroundService["storage"]["onChanged"]["addListener"]>[0];
  const deleteUrl = mock.fn(remove);
  const get = mock.fn(() => initial);
  startBackground({
    history: {
      deleteUrl,
      onVisited: { addListener: (listener) => { visit = listener; } },
    },
    storage: {
      local: { get },
      onChanged: { addListener: (listener) => { changed = listener; } },
    },
  });

  return {
    deleteUrl,
    get,
    visit: (url?: string) => visit({ url }),
    change: (values: Record<string, unknown>, area = "local") => {
      changed(Object.fromEntries(Object.entries(values).map(([key, newValue]) => [key, { newValue }])), area);
    },
  };
}

describe("history matching", () => {
  it("deletes matching URLs once even if multiple patterns match", async () => {
    const app = setup();
    await flush();
    app.change({ patterns: [PATTERN, "example"] });
    app.visit(URL);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 1);
    assert.deepEqual(app.deleteUrl.mock.calls[0].arguments, [{ url: URL }]);
  });

  it("ignores nonmatching, missing and empty URLs", async () => {
    const app = setup();
    await flush();
    app.visit("https://safe.com/");
    app.visit();
    app.visit("");
    assert.equal(app.deleteUrl.mock.callCount(), 0);
  });

  it("queues visits until the initial settings load completes", async () => {
    const initial = deferred<Record<string, unknown>>();
    const app = setup(initial.promise);
    app.visit(URL);
    assert.equal(app.deleteUrl.mock.callCount(), 0);
    initial.resolve({ patterns: [PATTERN], enabled: true });
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 1);
  });

  it("coalesces repeated startup visits before any deletion has started", async () => {
    const initial = deferred<Record<string, unknown>>();
    const app = setup(initial.promise);
    app.visit(URL);
    app.visit(URL);
    app.visit(URL);
    initial.resolve({ patterns: [PATTERN], enabled: true });
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 1);
  });
});

describe("race-safe settings", () => {
  it("disables immediately and resumes only for new visits after enabling", async () => {
    const app = setup();
    await flush();
    app.change({ enabled: false });
    app.visit(URL);
    assert.equal(app.deleteUrl.mock.callCount(), 0);
    app.change({ enabled: true });
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 0);
    app.visit(URL);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 1);
  });

  it("applies rapid pattern changes immediately without asynchronous rereads", async () => {
    const app = setup();
    await flush();
    app.change({ patterns: ["old\\.com"] });
    app.change({ patterns: ["new\\.com"] });
    app.visit("https://old.com/");
    app.visit("https://new.com/");
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 1);
    assert.deepEqual(app.deleteUrl.mock.calls[0].arguments, [{ url: "https://new.com/" }]);
    assert.equal(app.get.mock.callCount(), 1);
  });

  it("does not let a stale startup read overwrite newer patterns or a disable", async () => {
    const initial = deferred<Record<string, unknown>>();
    const app = setup(initial.promise);
    app.visit(URL);
    app.change({ patterns: ["new\\.com"], enabled: false });
    initial.resolve({ patterns: [PATTERN], enabled: true });
    await flush();
    app.visit(URL);
    assert.equal(app.deleteUrl.mock.callCount(), 0);
    app.change({ enabled: true });
    app.visit(URL);
    app.visit("https://new.com/");
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 1);
    assert.deepEqual(app.deleteUrl.mock.calls[0].arguments, [{ url: "https://new.com/" }]);
  });

  it("preserves unchanged startup fields when only one field changes", async () => {
    const initial = deferred<Record<string, unknown>>();
    const app = setup(initial.promise);
    app.change({ enabled: true });
    initial.resolve({ patterns: [PATTERN], enabled: false });
    await flush();
    app.visit(URL);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 1);
  });

  it("applies removal and storage-key deletion immediately", async () => {
    const app = setup();
    await flush();
    app.change({ patterns: undefined });
    app.visit(URL);
    assert.equal(app.deleteUrl.mock.callCount(), 0);
    app.change({ patterns: [PATTERN], enabled: false });
    app.change({ enabled: undefined });
    app.visit(URL);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 1);
  });

  it("ignores other storage areas and unrelated keys", async () => {
    const app = setup();
    await flush();
    app.change({ enabled: false, patterns: [] }, "sync");
    app.change({ other: true });
    app.visit(URL);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 1);
    assert.equal(app.get.mock.callCount(), 1);
  });

  it("skips invalid patterns rather than publishing a broken snapshot", async () => {
    const app = setup();
    await flush();
    app.change({ patterns: [null, "[", "(a+)+", PATTERN] });
    app.visit(URL);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 1);
  });

  it("does not enable deletion for malformed enabled values", async () => {
    const app = setup();
    await flush();
    app.change({ enabled: "false" });
    app.visit(URL);
    assert.equal(app.deleteUrl.mock.callCount(), 0);
  });

  it("preserves a disabled startup setting when only patterns change", async () => {
    const initial = deferred<Record<string, unknown>>();
    const app = setup(initial.promise);
    app.change({ patterns: [PATTERN] });
    initial.resolve({ patterns: [], enabled: false });
    await flush();
    app.visit(URL);
    assert.equal(app.deleteUrl.mock.callCount(), 0);
  });

  it("does not delete or replay visits when startup fails and enabled is unknown", async (t) => {
    const warn = t.mock.method(console, "warn", () => {});
    const initial = deferred<Record<string, unknown>>();
    const app = setup(initial.promise);
    app.visit(URL);
    app.change({ patterns: [PATTERN] });
    initial.reject(new Error(URL));
    await flush();

    app.visit(URL);
    assert.equal(app.deleteUrl.mock.callCount(), 0);
    assert.deepEqual(warn.mock.calls[0].arguments, ["Pristine History: failed to load settings."]);

    app.change({ enabled: true });
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 0);

    const newUrl = `${URL}/new`;
    app.visit(newUrl);
    await flush();
    assert.deepEqual(app.deleteUrl.mock.calls.map((call) => call.arguments), [[{ url: newUrl }]]);
  });

  it("does not replay startup visits that were cleared by disabling", async () => {
    const initial = deferred<Record<string, unknown>>();
    const app = setup(initial.promise);
    app.visit(URL);
    app.change({ enabled: false });
    app.visit(URL);
    app.change({ enabled: true });
    initial.resolve({ patterns: [PATTERN], enabled: true });
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 0);
    app.visit(URL);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 1);
  });
});

describe("deletion reliability", () => {
  it("does not suppress a real revisit after a successful deletion", async () => {
    const app = setup();
    await flush();
    app.visit(URL);
    await flush();
    app.visit(URL);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 2);
  });

  it("coalesces overlapping visits but runs a follow-up deletion", async () => {
    const first = deferred<void>();
    const app = setup(undefined, () => first.promise);
    await flush();
    app.visit(URL);
    app.visit(URL);
    app.visit(URL);
    assert.equal(app.deleteUrl.mock.callCount(), 1);
    first.resolve();
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 2);
  });

  it("limits concurrency to four and drains queued URLs", async () => {
    const calls: ReturnType<typeof deferred<void>>[] = [];
    const app = setup(undefined, () => {
      const call = deferred<void>();
      calls.push(call);
      return call.promise;
    });
    await flush();
    for (let i = 0; i < 6; i++) app.visit(`${URL}/${i}`);
    app.visit(`${URL}/4`);
    assert.equal(calls.length, 4);
    calls[0].resolve();
    await flush();
    assert.equal(calls.length, 5);
    calls[1].resolve();
    await flush();
    assert.equal(calls.length, 6);
    for (const call of calls) call.resolve();
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 6);
  });

  it("puts follow-up deletions behind already-queued URLs", async () => {
    const calls: ReturnType<typeof deferred<void>>[] = [];
    const app = setup(undefined, () => {
      const call = deferred<void>();
      calls.push(call);
      return call.promise;
    });
    await flush();
    for (let i = 0; i < 5; i++) app.visit(`${URL}/${i}`);
    app.visit(`${URL}/0`);
    calls[0].resolve();
    await flush();
    assert.deepEqual(app.deleteUrl.mock.calls[4].arguments, [{ url: `${URL}/4` }]);
    calls[1].resolve();
    await flush();
    assert.deepEqual(app.deleteUrl.mock.calls[5].arguments, [{ url: `${URL}/0` }]);
    for (const call of calls) call.resolve();
    await flush();
  });

  it("retries failures with backoff and preserves revisits during a retry", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const retry = deferred<void>();
    let attempts = 0;
    const app = setup(undefined, async () => {
      if (++attempts === 1) throw new Error("temporary failure");
      if (attempts === 2) await retry.promise;
    });
    await flush();
    app.visit(URL);
    await flush();
    t.mock.timers.tick(249);
    await flush();
    assert.equal(attempts, 1);
    app.visit(URL); // Waiting visits are covered by the pending retry.
    t.mock.timers.tick(1);
    await flush();
    assert.equal(attempts, 2);
    app.visit(URL); // A visit during that retry needs another pass.
    retry.resolve();
    await flush();
    assert.equal(attempts, 3);
    t.mock.timers.tick(10_000);
    await flush();
    assert.equal(attempts, 3);
  });

  it("stops after three failures, sanitizes logs, and allows a later visit", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const warn = t.mock.method(console, "warn", () => {});
    const app = setup(undefined, async () => { throw new Error(URL); });
    await flush();
    app.visit(URL);
    await flush();
    t.mock.timers.tick(250);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 2);
    t.mock.timers.tick(999);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 2);
    t.mock.timers.tick(1);
    await flush();
    t.mock.timers.tick(10_000);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 3);
    assert.deepEqual(warn.mock.calls[0].arguments, ["Pristine History: history deletion failed after 3 attempts."]);
    app.visit(URL);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 4);
    app.change({ enabled: false });
  });

  for (const change of [{ enabled: false }, { patterns: [] }]) {
    it(`cancels pending retries after ${Object.keys(change)[0]} changes`, async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const app = setup(undefined, async () => { throw new Error("temporary failure"); });
      await flush();
      app.visit(URL);
      await flush();
      app.change(change);
      t.mock.timers.tick(10_000);
      await flush();
      assert.equal(app.deleteUrl.mock.callCount(), 1);
    });

    it(`cancels queued deletions and in-flight follow-ups after ${Object.keys(change)[0]} changes`, async () => {
      const inFlight = deferred<void>();
      const app = setup(undefined, () => inFlight.promise);
      await flush();
      for (let i = 0; i < 6; i++) app.visit(`${URL}/${i}`);
      app.visit(`${URL}/0`);
      app.change(change);
      inFlight.resolve();
      await flush();
      assert.equal(app.deleteUrl.mock.callCount(), 4);
    });
  }

  it("does not resume cancelled retries when re-enabled before an in-flight failure", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const inFlight = deferred<void>();
    const app = setup(undefined, () => inFlight.promise);
    await flush();
    app.visit(URL);
    app.change({ enabled: false });
    app.change({ enabled: true });
    inFlight.reject(new Error("temporary failure"));
    await flush();
    t.mock.timers.tick(10_000);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 1);
  });

  it("handles a new visit after re-enabling while the old deletion is still in flight", async () => {
    const inFlight = deferred<void>();
    const app = setup(undefined, () => inFlight.promise);
    await flush();
    app.visit(URL);
    app.change({ enabled: false });
    app.change({ enabled: true });
    app.visit(URL);
    assert.equal(app.deleteUrl.mock.callCount(), 1);
    inFlight.resolve();
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 2);
  });

  it("does not let a waiting retry occupy a concurrency slot", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const app = setup(undefined, async ({ url }) => {
      if (url === URL) throw new Error("temporary failure");
    });
    await flush();
    app.visit(URL);
    for (let i = 0; i < 5; i++) app.visit(`${URL}/${i}`);
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 6);
    app.change({ enabled: false });
  });

  it("also handles synchronous API errors without blocking the queue", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let calls = 0;
    const app = setup(undefined, () => {
      if (++calls === 1) throw new Error("temporary failure");
      return Promise.resolve();
    });
    await flush();
    app.visit(URL);
    app.visit(`${URL}/other`);
    await flush();
    assert.equal(calls, 2);
    t.mock.timers.tick(250);
    await flush();
    assert.equal(calls, 3);
  });

  it("keeps a retry when changed patterns still match the URL", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let attempts = 0;
    const app = setup(undefined, async () => {
      if (++attempts === 1) throw new Error("temporary failure");
    });
    await flush();
    app.visit(URL);
    await flush();
    app.change({ patterns: ["example\\.com"] });
    t.mock.timers.tick(250);
    await flush();
    assert.equal(attempts, 2);
  });

  it("queues retries behind active deletions and coalesces visits before they start", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const inFlight = deferred<void>();
    let attempts = 0;
    const app = setup(undefined, async ({ url }) => {
      if (url !== URL) return inFlight.promise;
      if (++attempts === 1) throw new Error("temporary failure");
    });
    await flush();
    app.visit(URL);
    await flush();
    for (let i = 0; i < 4; i++) app.visit(`${URL}/${i}`);
    t.mock.timers.tick(250);
    await flush();
    app.visit(URL);
    assert.equal(attempts, 1);
    inFlight.resolve();
    await flush();
    assert.equal(attempts, 2);
    assert.equal(app.deleteUrl.mock.callCount(), 6);
  });

  for (const failure of [false, true]) {
    it(`does not revive cancelled work after patterns are restored (${failure ? "failure" : "success"})`, async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      const inFlight = deferred<void>();
      const app = setup(undefined, () => inFlight.promise);
      await flush();
      app.visit(URL);
      app.visit(URL);
      app.change({ patterns: [] });
      app.change({ patterns: [PATTERN] });
      if (failure) inFlight.reject(new Error("temporary failure"));
      else inFlight.resolve();
      await flush();
      t.mock.timers.tick(10_000);
      await flush();
      assert.equal(app.deleteUrl.mock.callCount(), 1);
    });
  }

  it("retries a new visit after re-enabling even when the old in-flight call fails", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const inFlight = deferred<void>();
    let attempts = 0;
    const app = setup(undefined, () => {
      if (++attempts === 1) return inFlight.promise;
      return Promise.resolve();
    });
    await flush();
    app.visit(URL);
    app.change({ enabled: false });
    app.change({ enabled: true });
    app.visit(URL);
    inFlight.reject(new Error("temporary failure"));
    await flush();
    t.mock.timers.tick(250);
    await flush();
    assert.equal(attempts, 2);
  });

  it("gives a new visit its full retry budget after an old call fails on its final attempt", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const warn = t.mock.method(console, "warn", () => {});
    const lastOldCall = deferred<void>();
    let attempts = 0;
    const app = setup(undefined, async () => {
      attempts++;
      if (attempts === 3) return lastOldCall.promise;
      if (attempts < 6) throw new Error("temporary failure");
    });
    await flush();

    app.visit(URL);
    await flush();
    t.mock.timers.tick(250);
    await flush();
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(attempts, 3);

    app.change({ enabled: false });
    app.change({ enabled: true });
    app.visit(URL);
    await flush();
    assert.equal(attempts, 3); // The new job must wait for the old call to settle.

    lastOldCall.reject(new Error("old call failed"));
    await flush();
    assert.equal(attempts, 4);
    t.mock.timers.tick(250);
    await flush();
    assert.equal(attempts, 5);
    t.mock.timers.tick(1000);
    await flush();
    assert.equal(attempts, 6);
    assert.equal(warn.mock.callCount(), 0);
  });

  it("cancels a retry that is queued behind other active calls", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const inFlight = deferred<void>();
    const app = setup(undefined, async ({ url }) => {
      if (url === URL) throw new Error("temporary failure");
      return inFlight.promise;
    });
    await flush();
    app.visit(URL);
    await flush();
    for (let i = 0; i < 4; i++) app.visit(`${URL}/${i}`);
    t.mock.timers.tick(250);
    await flush();
    app.change({ enabled: false });
    app.change({ enabled: true });
    inFlight.resolve();
    await flush();
    assert.equal(app.deleteUrl.mock.callCount(), 5);
  });

  it("starts fresh work after a waiting retry is cancelled, without reviving its timer", async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    let attempts = 0;
    const app = setup(undefined, async () => {
      if (++attempts === 1) throw new Error("temporary failure");
    });
    await flush();
    app.visit(URL);
    await flush();
    app.change({ enabled: false });
    app.change({ enabled: true });
    app.visit(URL);
    await flush();
    t.mock.timers.tick(10_000);
    await flush();
    assert.equal(attempts, 2);
  });
});
