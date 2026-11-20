# 🧪 Pristine History — Manual Test Plan

These checks verify the extension in Firefox. Run `npm test` before proceeding.

---

## Prerequisites

1. Follow the [development setup](README.md#development), then run `npm run build` to produce `dist/`.
2. Use a Firefox test profile so the checks don't delete your personal history.
3. Use a test site you can visit freely (e.g. `https://example.com`).

For history checks, open **Menu → History → Manage history**. For the background console, click **Inspect** next to Pristine History in `about:debugging#/runtime/this-firefox`.

---

## 1. Installation & Loading

### M-1.2 — Load extension in Firefox

1. Open `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Navigate to `dist/` and select `manifest.json`
4. ✅ Extension appears under "Temporary Extensions" with name "Pristine History"
5. ✅ No error banner shown
6. ✅ Extension icon appears in the toolbar

### M-1.3 — Icon display

1. Look at the toolbar icon — should be visible and not a blank square
2. Go to `about:addons`
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
4. Open Firefox history
5. Search for "example.com"
6. ✅ The visit to `https://example.com/` does **not** appear in history
7. (It may flash briefly — that's expected per the README)

### M-6.2 — Non-matching URL persists in history

1. With the same pattern (`^https://example\.com/`) still active
2. Visit `https://www.wikipedia.org/`
3. Open Firefox history and search for "wikipedia"
4. ✅ The visit to Wikipedia **does** appear in history

### M-6.3 — Disabled extension does not delete

1. Click the Pristine History toolbar icon
2. Uncheck the **toggle** to disable
3. Visit `https://example.com/` again
4. Open Firefox history and search for "example.com"
5. ✅ The visit **does** appear in history this time

### M-6.4 — Re-enabled extension resumes deleting

1. Click the toolbar icon and re-check the toggle to enable
2. Visit `https://example.com/some-other-page`
3. Open Firefox history and search for "example.com"
4. ✅ The new visit does **not** appear in history
5. ✅ The visit from M-6.3 (when disabled) still remains

### M-6.7 — All prior visits for a URL are removed

1. Disable the extension via popup
2. Visit `https://example.com/repeated` five times
3. Confirm `https://example.com/repeated` appears in Firefox history
4. Re-enable the extension
5. Visit `https://example.com/repeated` one more time
6. Open Firefox history and search for "example.com/repeated"
7. ✅ **All** visits (including the 5 prior ones) are gone — `deleteUrl()` removes all visits for that URL

### M-6.8 — Revisits after deletion

1. With `^https://example\.com/` enabled, visit `https://example.com/revisit`.
2. Confirm the URL is absent from Firefox history.
3. Open that exact URL again in a new tab.
4. ✅ The new visit is also removed. The automated tests cover overlapping visits and follow-up deletions.

### M-6.9 — Redirect chain

1. Add pattern: `^https://httpbin\.org/get$`
2. Visit `https://httpbin.org/redirect/3` and confirm it lands on `https://httpbin.org/get`.
3. ✅ The matching final URL does not persist in Firefox history. Intermediate redirects need not appear in history.

### M-6.10 — Pattern added at runtime takes effect

1. Start with no patterns configured
2. Visit `https://example.com/runtime-test`
3. Confirm it appears in Firefox history
4. Now open options and add pattern: `^https://example\.com/`
5. Visit `https://example.com/runtime-test-2`
6. ✅ The new visit does **not** appear in history (pattern picked up without restart)

### M-6.11 — Pattern removed at runtime stops deleting

1. With pattern `^https://example\.com/` active, confirm deletion works
2. Open options and click **Remove** on the pattern
3. Visit `https://example.com/after-removal`
4. Open Firefox history
5. ✅ The visit **does** appear in history

---

## 4. Edge Cases in Real Browser

### M-7.2 — Unicode URL

1. Add pattern: `unicode`
2. Visit a URL containing unicode characters (e.g. `https://example.com/unicode-café`)
3. Open Firefox history
4. ✅ The URL is deleted without errors
5. ✅ No errors in the background console

### M-7.3 — Very long URL

1. Add pattern: `example\.com`
2. Construct a URL longer than 2000 characters: `https://example.com/?q=` followed by 2000+ characters of `a`
3. Paste it into the address bar and visit
4. ✅ The URL is deleted from history without errors
5. ✅ No errors in the background console

### M-7.4 — Firefox internal pages don't trigger errors

1. Add the pattern `^about:`.
2. Visit `about:config` and `about:addons`.
3. ✅ The extension stays responsive and its background console shows no errors for these pages.
4. Remove the test pattern.

### M-7.5 — Extension survives browser restart

Requires a persistently installed build, such as a signed XPI. Firefox removes temporary add-ons on exit; use M-8.3 for the temporary build.

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

1. With deletion enabled, open the extension's background console.
2. In the console, run:
   ```js
   await browser.storage.local.set({ patterns: ["^https://example\\.com/\\?devtools-test=1$"] });
   ```
3. Visit `https://example.com/?devtools-test=1`.
4. Open Firefox history.
5. ✅ The URL was deleted — the background script picked up the storage change
6. Clean up: remove the injected pattern via options or DevTools

---

## 5. Firefox End-to-End and Background Reload

### M-8.2 — Firefox end-to-end

1. Load the extension in Firefox (see M-1.2)
2. Perform tests M-6.1 through M-6.4 and M-6.10 through M-6.11
3. ✅ Pattern changes and the popup toggle persist, and history deletion follows the current settings

### M-8.3 — Background reload

1. Enable deletion and configure `^https://example\.com/`.
2. Click **Reload** next to the temporary add-on in `about:debugging`.
3. Once reload completes, visit `https://example.com/after-reload`.
4. ✅ The saved settings still apply and the matching URL does not persist in Firefox history.

---

## Checklist Summary

| # | Test | Pass? |
|---|------|-------|
| M-1.2 | Install in Firefox | ☐ |
| M-1.3 | Icon display | ☐ |
| M-2.7 | Manage Patterns navigation | ☐ |
| M-6.1 | Matching URL deleted | ☐ |
| M-6.2 | Non-matching URL persists | ☐ |
| M-6.3 | Disabled = no deletion | ☐ |
| M-6.4 | Re-enable = deletion resumes | ☐ |
| M-6.7 | All prior visits removed | ☐ |
| M-6.8 | Revisits after deletion | ☐ |
| M-6.9 | Matching redirect destination removed | ☐ |
| M-6.10 | Runtime pattern add | ☐ |
| M-6.11 | Runtime pattern remove | ☐ |
| M-7.2 | Unicode URL | ☐ |
| M-7.3 | Very long URL | ☐ |
| M-7.4 | Internal pages no errors | ☐ |
| M-7.5 | Survives browser restart (installed build only) | ☐ |
| M-7.6 | Storage change from DevTools | ☐ |
| M-8.2 | Firefox full E2E | ☐ |
| M-8.3 | Background reload | ☐ |
