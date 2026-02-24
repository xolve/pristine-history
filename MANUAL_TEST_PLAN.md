# 🧪 Pristine History — Manual Test Plan

Tests below require a real browser and **cannot** be covered by the automated suite.
Run `npm test` first to verify all 74 automated tests pass before proceeding.

---

## Prerequisites

1. Run `npm run build` to produce the `dist/` directory
2. Have Chrome (or Edge) and Firefox available
3. Have a test site you can visit freely (e.g. `https://example.com`)

---

## 1. Installation & Loading

### M-1.1 — Load extension in Chrome / Edge

1. Open `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `dist/` directory
5. ✅ Extension appears in the list with name "Pristine History" and version "1.0.0"
6. ✅ No errors shown on the extension card (no "Errors" button, or button shows 0)
7. ✅ Extension icon appears in the toolbar (pin it if needed)

### M-1.2 — Load extension in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Navigate to `dist/` and select `manifest.json`
4. ✅ Extension appears under "Temporary Extensions" with name "Pristine History"
5. ✅ No error banner shown
6. ✅ Extension icon appears in the toolbar

### M-1.3 — Icon display

1. Look at the toolbar icon — should be visible and not a blank square
2. Go to `chrome://extensions` (Chrome) or `about:addons` (Firefox)
3. ✅ The 128px icon renders correctly on the extension card
4. ✅ The 48px icon renders correctly in the toolbar

---

## 2. Popup — Manage Patterns Navigation

### M-2.7 — "Manage Patterns" opens the options page

1. Click the Pristine History icon in the toolbar to open the popup
2. Click the **Manage Patterns** button
3. ✅ The options page opens in a new tab
4. ✅ The options page URL is the extension's `options.html`
5. ✅ The popup closes after clicking

---

## 3. End-to-End History Deletion

### M-6.1 — Matching URL is deleted from history

1. Open the options page and add pattern: `^https://example\.com/`
2. Ensure the extension is **Enabled** (check popup)
3. Open a new tab and visit `https://example.com/`
4. Open `chrome://history` (or press Ctrl+H)
5. Search for "example.com"
6. ✅ The visit to `https://example.com/` does **not** appear in history
7. (It may flash briefly — that's expected per the README)

### M-6.2 — Non-matching URL persists in history

1. With the same pattern (`^https://example\.com/`) still active
2. Visit `https://www.wikipedia.org/`
3. Open `chrome://history` and search for "wikipedia"
4. ✅ The visit to Wikipedia **does** appear in history

### M-6.3 — Disabled extension does not delete

1. Click the Pristine History toolbar icon
2. Uncheck the **toggle** to disable
3. Visit `https://example.com/` again
4. Open `chrome://history` and search for "example.com"
5. ✅ The visit **does** appear in history this time

### M-6.4 — Re-enabled extension resumes deleting

1. Click the toolbar icon and re-check the toggle to enable
2. Visit `https://example.com/some-other-page`
3. Open `chrome://history` and search for "example.com"
4. ✅ The new visit does **not** appear in history
5. ✅ The visit from M-6.3 (when disabled) still remains

### M-6.7 — All prior visits for a URL are removed

1. Disable the extension via popup
2. Visit `https://example.com/repeated` five times
3. Open `chrome://history` — confirm all 5 visits are listed
4. Re-enable the extension
5. Visit `https://example.com/repeated` one more time
6. Open `chrome://history` and search for "example.com/repeated"
7. ✅ **All** visits (including the 5 prior ones) are gone — `deleteUrl()` removes all visits for that URL

### M-6.9 — Redirect chain dedup

1. Add pattern: `^https://httpbin\.org/`
2. Visit a URL that redirects through `httpbin.org` (e.g. `https://httpbin.org/redirect/3`)
3. Open the service worker console (chrome://extensions → Inspect views → service worker)
4. ✅ No repeated "failed to delete" warnings for the same URL
5. ✅ Only one `deleteUrl` call per unique URL in the chain

### M-6.10 — Pattern added at runtime takes effect

1. Start with no patterns configured
2. Visit `https://example.com/runtime-test`
3. Confirm it appears in `chrome://history`
4. Now open options and add pattern: `^https://example\.com/`
5. Visit `https://example.com/runtime-test-2`
6. ✅ The new visit does **not** appear in history (pattern picked up without restart)

### M-6.11 — Pattern removed at runtime stops deleting

1. With pattern `^https://example\.com/` active, confirm deletion works
2. Open options and click **Remove** on the pattern
3. Visit `https://example.com/after-removal`
4. Open `chrome://history`
5. ✅ The visit **does** appear in history

---

## 4. Edge Cases in Real Browser

### M-7.2 — Unicode URL

1. Add pattern: `unicode`
2. Visit a URL containing unicode characters (e.g. `https://example.com/unicode-café`)
3. Open `chrome://history`
4. ✅ The URL is deleted without errors
5. ✅ No errors in the service worker console

### M-7.3 — Very long URL

1. Add pattern: `example\.com`
2. Construct a URL longer than 2000 characters: `https://example.com/?q=` followed by 2000+ characters of `a`
3. Paste it into the address bar and visit
4. ✅ The URL is deleted from history without errors
5. ✅ No errors in the service worker console

### M-7.4 — about: / chrome: pages don't trigger errors

1. Add a catch-all pattern: `.*`
2. Visit `chrome://settings` (Chrome) or `about:config` (Firefox)
3. Visit `chrome://history`
4. Open the service worker console
5. ✅ No errors or warnings related to these internal URLs
6. ✅ The extension does not crash or become unresponsive
7. Remove the catch-all pattern when done

### M-7.5 — Extension survives browser restart

1. Add two patterns and disable the extension
2. Fully close the browser (all windows)
3. Reopen the browser
4. Click the Pristine History toolbar icon
5. ✅ Toggle shows **Disabled** (state persisted)
6. ✅ Pattern count shows "2 patterns configured"
7. Open options page
8. ✅ Both patterns are still listed
9. Re-enable and visit a matching URL
10. ✅ History deletion works after restart

### M-7.6 — Storage change from DevTools

1. Open the service worker DevTools (chrome://extensions → Inspect views)
2. In the console, run:
   ```js
   chrome.storage.local.set({ patterns: ["^https://devtools-injected\\.com/"] });
   ```
3. Visit `https://devtools-injected.com/` (or any URL matching that pattern — it will likely 404, but that's fine)
4. Open `chrome://history`
5. ✅ The URL was deleted — the background script picked up the storage change
6. Clean up: remove the injected pattern via options or DevTools

---

## 5. Service Worker Lifecycle (Chrome only)

### M-8.3 — Service worker wakes from idle

1. Load the extension and add a pattern: `^https://example\.com/`
2. Open `chrome://serviceworker-internals/`
3. Find the Pristine History service worker entry
4. Wait 5 minutes (Chrome terminates idle service workers after ~5 min) **or** click **Stop** to force terminate it
5. Verify the status shows "STOPPED"
6. Visit `https://example.com/after-idle`
7. ✅ The `history.onVisited` event wakes the service worker
8. ✅ The URL is deleted from `chrome://history`
9. ✅ Verify in `chrome://serviceworker-internals/` that the worker is "RUNNING" again

---

## 6. Cross-Browser Verification

### M-8.1 — Chrome end-to-end

1. Perform tests M-6.1 through M-6.4 in **Chrome**
2. ✅ All pass — `chrome.history.deleteUrl` works correctly
3. ✅ `chrome.storage.local` persists data across popup open/close

### M-8.2 — Firefox end-to-end

1. Load the extension in Firefox (see M-1.2)
2. Perform tests M-6.1 through M-6.4 in **Firefox**
3. ✅ All pass — the `browser.*` / `chrome.*` API works via the `api.ts` shim
4. ✅ Popup toggle works
5. ✅ Options page add/remove works
6. ✅ History deletion works
7. Note: Firefox uses `about:debugging` for extension management, and history is at the Library panel (Ctrl+Shift+H)

---

## Checklist Summary

| # | Test | Browser | Pass? |
|---|------|---------|-------|
| M-1.1 | Install in Chrome/Edge | Chrome | ☐ |
| M-1.2 | Install in Firefox | Firefox | ☐ |
| M-1.3 | Icon display | Both | ☐ |
| M-2.7 | Manage Patterns navigation | Chrome | ☐ |
| M-6.1 | Matching URL deleted | Chrome | ☐ |
| M-6.2 | Non-matching URL persists | Chrome | ☐ |
| M-6.3 | Disabled = no deletion | Chrome | ☐ |
| M-6.4 | Re-enable = deletion resumes | Chrome | ☐ |
| M-6.7 | All prior visits removed | Chrome | ☐ |
| M-6.9 | Redirect chain dedup | Chrome | ☐ |
| M-6.10 | Runtime pattern add | Chrome | ☐ |
| M-6.11 | Runtime pattern remove | Chrome | ☐ |
| M-7.2 | Unicode URL | Chrome | ☐ |
| M-7.3 | Very long URL | Chrome | ☐ |
| M-7.4 | Internal pages no errors | Chrome | ☐ |
| M-7.5 | Survives browser restart | Chrome | ☐ |
| M-7.6 | Storage change from DevTools | Chrome | ☐ |
| M-8.1 | Chrome full E2E | Chrome | ☐ |
| M-8.2 | Firefox full E2E | Firefox | ☐ |
| M-8.3 | Service worker idle wake | Chrome | ☐ |
