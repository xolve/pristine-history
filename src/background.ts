import { history, storage } from "webextension-polyfill";
import { validatePattern } from "./regex-validator";

let compiledPatterns: RegExp[] = [];

let enabled = true;

let cacheReady = false;
let pendingVisits: string[] = [];

function compilePatterns(rawPatterns: string[]): RegExp[] {
  const compiled: RegExp[] = [];
  for (const src of rawPatterns) {
    try {
      if (validatePattern(src).valid) {
        compiled.push(new RegExp(src));
      }
    } catch (e) {
      console.error(`Failed to compile pattern "${src}": ${(e as Error).message}`);
    }
  }
  return compiled;
}

function processUrl(url: string): void {
  if (!enabled) return;

  for (const re of compiledPatterns) {
    if (re.test(url)) {
      history.deleteUrl({ url }).catch((err) => {
        console.warn("Pristine History: failed to delete", url, err);
      });

      return;
    }
  }
}

async function refreshCache(): Promise<void> {
  try {
    const data = await storage.local.get({ patterns: [], enabled: true });
    compiledPatterns = compilePatterns(data.patterns as string[]);
    enabled = data.enabled as boolean;

    cacheReady = true;
    for (const url of pendingVisits) {
      processUrl(url);
    }
    pendingVisits = [];
  } catch (err) {
    console.error("Pristine History: failed to refresh cache", err);
    cacheReady = true;
  }
}

history.onVisited.addListener((result) => {
  const url = result.url;
  if (!url) return;

  if (!cacheReady) {
    pendingVisits.push(url);
    return;
  }

  processUrl(url);
});

storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (changes.patterns || changes.enabled) {
    refreshCache();
  }
});



refreshCache();


