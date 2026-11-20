import { history, storage } from "webextension-polyfill";
import { validatePattern } from "./regex-validator";

interface Settings {
  // Undefined means the field hasn't been read or received in a change event.
  patterns?: RegExp[];
  enabled?: boolean;
}

interface StorageChange {
  newValue?: unknown;
}

export interface BackgroundService {
  history: {
    deleteUrl(details: { url: string }): Promise<unknown>;
    onVisited: {
      addListener(listener: (result: { url?: string }) => void): void;
    };
  };
  storage: {
    local: {
      get(defaults: { patterns: string[]; enabled: boolean }): Promise<Record<string, unknown>>;
    };
    onChanged: {
      addListener(
        listener: (changes: Record<string, StorageChange | undefined>, area: string) => void,
      ): void;
    };
  };
}

interface Job {
  attempts: number;
  revisit: boolean;
  retryTimer?: ReturnType<typeof setTimeout>;
}

const MAX_CONCURRENT_DELETIONS = 4;
const RETRY_DELAYS_MS = [250, 1000];

function compilePatterns(value: unknown): RegExp[] {
  if (!Array.isArray(value)) return [];

  return value
    .filter(
      (pattern): pattern is string =>
        typeof pattern === "string" && validatePattern(pattern).valid,
    )
    .map((pattern) => new RegExp(pattern));
}

function resolveEnabledSetting(value: unknown): boolean {
  // An absent key restores the default; a malformed value does not.
  return value === undefined || value === true;
}

export function startBackground({ history, storage }: BackgroundService): void {
  const settings: Settings = {};
  let startupVisits: Set<string> | undefined = new Set();

  const jobs = new Map<string, Job>(); // Desired work, in queue order.
  const inFlight = new Map<string, Job>(); // Browser calls that can't be cancelled.

  function matches(url: string): boolean {
    return settings.enabled === true &&
      (settings.patterns?.some((pattern) => pattern.test(url)) ?? false);
  }

  function enqueue(url: string, job: Job = { attempts: 0, revisit: false }): void {
    // Retries and follow-ups go behind already-queued URLs.
    jobs.delete(url);
    jobs.set(url, job);
  }

  function pumpQueue(): void {
    for (const [url, job] of jobs) {
      if (inFlight.size >= MAX_CONCURRENT_DELETIONS) break;
      if (inFlight.has(url) || job.retryTimer !== undefined) continue;

      inFlight.set(url, job);
      job.revisit = false;
      // Settle asynchronously even if the browser API throws synchronously.
      void attemptDeletion(url, job).finally(() => {
        inFlight.delete(url);
        pumpQueue();
      });
    }
  }

  async function attemptDeletion(url: string, job: Job): Promise<void> {
    job.attempts++;
    let succeeded = false;
    try {
      await history.deleteUrl({ url });
      succeeded = true;
    } catch {
      // The browser API has no portable error classification.
    }

    // The old call must not affect a job created after cancellation.
    if (jobs.get(url) !== job) return;

    if (succeeded) {
      if (job.revisit) enqueue(url);
      else jobs.delete(url);
      return;
    }

    const delay = RETRY_DELAYS_MS[job.attempts - 1];
    if (delay === undefined) {
      jobs.delete(url);
      console.warn(`Pristine History: history deletion failed after ${job.attempts} attempts.`);
      return;
    }

    job.retryTimer = setTimeout(() => {
      if (jobs.get(url) !== job) return;
      job.retryTimer = undefined;
      enqueue(url, job);
      pumpQueue();
    }, delay);
  }

  function processVisit(url: string): void {
    if (!matches(url)) return;

    const job = jobs.get(url);
    if (job) {
      // Work that hasn't started yet already covers this visit.
      if (inFlight.get(url) === job) job.revisit = true;
      return;
    }

    enqueue(url);
    pumpQueue();
  }

  history.onVisited.addListener(({ url }) => {
    if (!url || settings.enabled === false) return;
    if (startupVisits) startupVisits.add(url);
    else processVisit(url);
  });

  storage.onChanged.addListener(({ patterns, enabled }, area) => {
    if (area !== "local" || (!patterns && !enabled)) return;

    if (patterns) settings.patterns = compilePatterns(patterns.newValue);
    if (enabled) settings.enabled = resolveEnabledSetting(enabled.newValue);
    if (settings.enabled === false) startupVisits?.clear();

    for (const [url, job] of jobs) {
      if (matches(url)) continue;
      clearTimeout(job.retryTimer);
      jobs.delete(url);
    }
  });

  async function initialize(): Promise<void> {
    try {
      const data = await storage.local.get({ patterns: [], enabled: true });
      // A delayed read cannot overwrite a field already set by a change event.
      settings.patterns ??= compilePatterns(data.patterns);
      settings.enabled ??= resolveEnabledSetting(data.enabled);
    } catch {
      console.warn("Pristine History: failed to load settings.");
    }

    const buffered = startupVisits;
    startupVisits = undefined;
    // Only replay visits if storage or change events supplied both fields.
    if (settings.enabled === true && settings.patterns?.length) {
      buffered?.forEach(processVisit);
    }
  }

  void initialize();
}

startBackground({ history, storage });
