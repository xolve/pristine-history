import { describe, it, before, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// Mock chrome API — set on globalThis so api.ts picks it up on import
// ---------------------------------------------------------------------------

type VisitCallback = (result: { url?: string }) => void;
type ChangedCallback = (
  changes: Record<string, { newValue?: unknown }>,
  area: string,
) => void;

let onVisitedCallback: VisitCallback;
let onChangedCallback: ChangedCallback;

const mockStorage: Record<string, unknown> = {
  patterns: [],
  enabled: true,
};

const deleteUrlMock = mock.fn(async () => {});

const mockChrome = {
  storage: {
    local: {
      get: mock.fn(async (defaults: Record<string, unknown>) => {
        const result: Record<string, unknown> = {};
        for (const key of Object.keys(defaults)) {
          result[key] = key in mockStorage ? mockStorage[key] : defaults[key];
        }
        return result;
      }),
      set: mock.fn(async (items: Record<string, unknown>) => {
        Object.assign(mockStorage, items);
      }),
    },
    onChanged: {
      addListener: mock.fn((cb: ChangedCallback) => {
        onChangedCallback = cb;
      }),
    },
  },
  history: {
    onVisited: {
      addListener: mock.fn((cb: VisitCallback) => {
        onVisitedCallback = cb;
      }),
    },
    deleteUrl: deleteUrlMock,
  },
};

(globalThis as any).chrome = mockChrome;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function setStorage(
  data: Partial<{ patterns: string[]; enabled: boolean }>,
) {
  const changes: Record<string, { newValue: unknown }> = {};
  for (const [key, value] of Object.entries(data)) {
    changes[key] = { newValue: value };
    mockStorage[key] = value;
  }
  onChangedCallback(changes, "local");
  await new Promise((r) => setTimeout(r, 5));
}

let urlCounter = 0;
function uniqueUrl(base: string) {
  return `${base}/__t${++urlCounter}`;
}

function visit(url?: string) {
  onVisitedCallback(url !== undefined ? { url } : {});
}

// ---------------------------------------------------------------------------
// Load background module once — listeners are captured via the mocks
// ---------------------------------------------------------------------------

before(async () => {
  await import("../background");
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockStorage.patterns = [];
  mockStorage.enabled = true;
  deleteUrlMock.mock.resetCalls();
});

// ---------------------------------------------------------------------------
// 6.1 — Basic deletion
// ---------------------------------------------------------------------------
describe("6.1 basic deletion", () => {
  it("deletes a URL matching a pattern", async () => {
    await setStorage({ patterns: ["^https://example\\.com/"] });
    const url = uniqueUrl("https://example.com");
    visit(url);
    assert.equal(deleteUrlMock.mock.callCount(), 1);
    assert.deepEqual((deleteUrlMock.mock.calls[0] as any).arguments[0], { url });
  });
});

// ---------------------------------------------------------------------------
// 6.2 — Non-matching URL not deleted
// ---------------------------------------------------------------------------
describe("6.2 non-matching URL", () => {
  it("does not delete a URL that matches no pattern", async () => {
    await setStorage({ patterns: ["^https://example\\.com/"] });
    visit(uniqueUrl("https://safe.com"));
    assert.equal(deleteUrlMock.mock.callCount(), 0);
  });
});

// ---------------------------------------------------------------------------
// 6.3 — Disabled state
// ---------------------------------------------------------------------------
describe("6.3 disabled state", () => {
  it("does not delete when extension is disabled", async () => {
    await setStorage({
      patterns: ["^https://example\\.com/"],
      enabled: false,
    });
    visit(uniqueUrl("https://example.com"));
    assert.equal(deleteUrlMock.mock.callCount(), 0);
  });
});

// ---------------------------------------------------------------------------
// 6.4 — Re-enable
// ---------------------------------------------------------------------------
describe("6.4 re-enable", () => {
  it("resumes deleting after re-enabling", async () => {
    await setStorage({
      patterns: ["^https://example\\.com/"],
      enabled: false,
    });
    visit(uniqueUrl("https://example.com"));
    assert.equal(deleteUrlMock.mock.callCount(), 0);

    await setStorage({ enabled: true });
    const url = uniqueUrl("https://example.com");
    visit(url);
    assert.equal(deleteUrlMock.mock.callCount(), 1);
    assert.deepEqual((deleteUrlMock.mock.calls[0] as any).arguments[0], { url });
  });
});

// ---------------------------------------------------------------------------
// 6.8 — Dedup / rapid revisits
// ---------------------------------------------------------------------------
describe("6.8 dedup for rapid revisits", () => {
  it("only calls deleteUrl once for the same URL within TTL", async () => {
    await setStorage({ patterns: ["^https://example\\.com/"] });
    const url = uniqueUrl("https://example.com");
    visit(url);
    visit(url);
    visit(url);
    assert.equal(deleteUrlMock.mock.callCount(), 1);
  });

  it("allows deletion again after TTL expires", async () => {
    await setStorage({ patterns: ["^https://example\\.com/"] });
    const url = uniqueUrl("https://example.com");
    visit(url);
    assert.equal(deleteUrlMock.mock.callCount(), 1);

    // Wait for the 2000ms dedup TTL to expire
    await new Promise((r) => setTimeout(r, 2100));

    visit(url);
    assert.equal(deleteUrlMock.mock.callCount(), 2);
  });

  it("dedup is per-URL — different URLs are not deduped", async () => {
    await setStorage({ patterns: ["example\\.com"] });
    visit(uniqueUrl("https://example.com/a"));
    visit(uniqueUrl("https://example.com/b"));
    assert.equal(deleteUrlMock.mock.callCount(), 2);
  });
});

// ---------------------------------------------------------------------------
// 6.10 — Pattern added at runtime
// ---------------------------------------------------------------------------
describe("6.10 pattern added at runtime", () => {
  it("picks up newly added patterns via storage change", async () => {
    const url = uniqueUrl("https://newsite.com");
    visit(url);
    assert.equal(deleteUrlMock.mock.callCount(), 0);

    await setStorage({ patterns: ["^https://newsite\\.com/"] });
    visit(url);
    assert.equal(deleteUrlMock.mock.callCount(), 1);
  });
});

// ---------------------------------------------------------------------------
// 6.11 — Pattern removed at runtime
// ---------------------------------------------------------------------------
describe("6.11 pattern removed at runtime", () => {
  it("stops deleting after pattern is removed", async () => {
    await setStorage({ patterns: ["^https://removed\\.com/"] });
    const url = uniqueUrl("https://removed.com");
    visit(url);
    assert.equal(deleteUrlMock.mock.callCount(), 1);

    // Wait for dedup to expire
    await new Promise((r) => setTimeout(r, 2100));

    await setStorage({ patterns: [] });
    visit(url);
    // Still 1 — pattern was removed, no new deletion
    assert.equal(deleteUrlMock.mock.callCount(), 1);
  });
});

// ---------------------------------------------------------------------------
// 7.6 — storage.onChanged from external context
// ---------------------------------------------------------------------------
describe("7.6 storage.onChanged from external context", () => {
  it("ignores changes from non-local areas", async () => {
    await setStorage({ patterns: ["^https://example\\.com/"] });
    const callsBefore = mockChrome.storage.local.get.mock.callCount();

    // Fire a change from "sync" area — should be ignored.
    onChangedCallback(
      { patterns: { newValue: ["^https://other\\.com/"] } },
      "sync",
    );
    await new Promise((r) => setTimeout(r, 5));

    assert.equal(mockChrome.storage.local.get.mock.callCount(), callsBefore);
  });

  it("refreshes cache when patterns change in local storage", async () => {
    await setStorage({ patterns: ["^https://refresh-old\\.com/"] });
    const url1 = uniqueUrl("https://refresh-old.com");
    visit(url1);
    assert.equal(deleteUrlMock.mock.callCount(), 1);

    await new Promise((r) => setTimeout(r, 2100));

    await setStorage({ patterns: ["^https://refresh-new\\.com/"] });
    visit(url1);
    assert.equal(deleteUrlMock.mock.callCount(), 1); // old pattern gone
    visit(uniqueUrl("https://refresh-new.com"));
    assert.equal(deleteUrlMock.mock.callCount(), 2);
  });
});

// ---------------------------------------------------------------------------
// Edge: empty / missing URL in visit result
// ---------------------------------------------------------------------------
describe("edge — visit with no URL", () => {
  it("does nothing when result.url is undefined", async () => {
    await setStorage({ patterns: [".*"] });
    visit(undefined);
    assert.equal(deleteUrlMock.mock.callCount(), 0);
  });

  it("does nothing when result.url is empty string", async () => {
    await setStorage({ patterns: [".*"] });
    visit("");
    assert.equal(deleteUrlMock.mock.callCount(), 0);
  });
});
