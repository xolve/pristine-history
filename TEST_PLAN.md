# 🧪 Pristine History — Test Plan

## 1. Installation & Loading
| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 1.1 | Load in Chrome/Edge | Load `dist/` as unpacked extension | Extension icon appears, no console errors |
| 1.2 | Load in Firefox | Load via `about:debugging` | Same as above |
| 1.3 | Icons display | Check toolbar and `chrome://extensions` | 48px and 128px icons render correctly |

## 2. Popup (Toggle & Status)
| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 2.1 | Default state | Click extension icon | Toggle is **checked**, label says "Enabled", pattern count shows "0 patterns configured" |
| 2.2 | Disable | Uncheck toggle | Label changes to "Disabled" |
| 2.3 | Re-enable | Check toggle again | Label changes back to "Enabled" |
| 2.4 | Persistence | Disable → close popup → reopen | Toggle remains unchecked, label says "Disabled" |
| 2.5 | Pattern count | Add 3 patterns in options, reopen popup | Shows "3 patterns configured" |
| 2.6 | Singular count | Have exactly 1 pattern | Shows "1 pattern configured" (no trailing "s") |
| 2.7 | Manage Patterns button | Click "Manage Patterns" | Options page opens |

## 3. Options — Pattern Management
| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 3.1 | Empty state | Open options with no patterns | "No patterns configured yet." message visible |
| 3.2 | Add valid pattern | Type `^https://example\.com/` → click Add | Pattern appears in list, input clears, empty message hides |
| 3.3 | Add via Enter key | Type pattern → press Enter | Same as clicking Add |
| 3.4 | Add empty input | Leave input blank → click Add | Nothing happens (no error, no add) |
| 3.5 | Duplicate pattern | Add same pattern twice | Error: "This pattern already exists." |
| 3.6 | Invalid regex | Type `[unclosed` → Add | Error: "Invalid regex: …" |
| 3.7 | Pattern too long | Enter 501+ character pattern | Error: "Pattern exceeds maximum length of 500 characters." |
| 3.8 | Max patterns (50) | Add 50 patterns, then try 51st | Error: "Maximum of 50 patterns allowed." |
| 3.9 | Remove pattern | Click "Remove" on a pattern | Pattern disappears, list updates |
| 3.10 | Remove last pattern | Remove the only pattern | "No patterns configured yet." reappears |
| 3.11 | Persistence | Add patterns → reload options page | Patterns still present |

## 4. Options — ReDoS Validation
| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 4.1 | Nested quantifiers `(a+)+` | Add `(a+)+` | Rejected — catastrophic backtracking error |
| 4.2 | Nested quantifiers `(a*)*` | Add `(a*)*` | Rejected |
| 4.3 | Quantifier + braces `(a{2,})*` | Add `(a{2,})*` | Rejected |
| 4.4 | Overlapping alternation `(.*\|.*)+` | Add `(.*\|.*)+` | Rejected |
| 4.5 | Backreference `(.)\1` | Add `(.)\1` | Rejected |
| 4.6 | Safe quantifier `(abc)+` | Add `(abc)+` | Accepted ✅ |
| 4.7 | Safe complex `^https?://.*\.pdf$` | Add it | Accepted ✅ |

## 5. Options — URL Tester
| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 5.1 | Matching URL | Pattern: `^https://example\.com/` → test `https://example.com/page` | "✓ Matches pattern: …" (green) |
| 5.2 | Non-matching URL | Same pattern → test `https://other.com/` | "✗ Does not match any pattern." (red) |
| 5.3 | Empty test input | Click Test with empty input | Nothing happens |
| 5.4 | Test via Enter key | Type URL → press Enter | Test executes |
| 5.5 | Multiple patterns | Add 3 patterns, test URL matching 2nd one | Shows first matching pattern |
| 5.6 | No patterns | Remove all patterns → test any URL | "✗ Does not match any pattern." |

## 6. Core Functionality — History Deletion
| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 6.1 | Basic deletion | Add pattern `^https://example\.com/`, visit `https://example.com/page` | URL does **not** persist in `chrome://history` |
| 6.2 | Non-matching URL | Visit a URL that doesn't match any pattern | URL **does** persist in history |
| 6.3 | Disabled state | Disable via popup → visit matching URL | URL persists in history (not deleted) |
| 6.4 | Re-enable | Re-enable → visit matching URL | URL is deleted again |
| 6.5 | Multiple patterns | Add 3 patterns → visit URLs matching different ones | All matching URLs deleted |
| 6.6 | Partial URL match | Pattern `utm_` → visit `https://foo.com/?utm_source=bar` | URL deleted |
| 6.7 | All visits removed | Visit same matching URL 5 times, pattern added after | `deleteUrl()` removes all visits for that URL |
| 6.8 | Dedup / rapid revisits | Visit same matching URL multiple times within 2 seconds | Only one `deleteUrl()` call (check console for no duplicate warns) |
| 6.9 | Redirect chain dedup | URL that redirects through matching URL | Dedup prevents redundant delete calls |
| 6.10 | Pattern added at runtime | Add new pattern while extension running → visit matching URL | New pattern takes effect without restart |
| 6.11 | Pattern removed at runtime | Remove pattern → visit previously-matching URL | URL now persists in history |

## 7. Edge Cases & Robustness
| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 7.1 | Special regex chars in URL | Pattern `\?q=` → visit `https://google.com?q=test` | Matches and deletes |
| 7.2 | Unicode URL | Visit URL with unicode chars matching a pattern | Handled correctly |
| 7.3 | Very long URL | Visit URL >2000 chars matching pattern | Deleted without errors |
| 7.4 | about: / chrome: URLs | These don't fire `onVisited` | No errors, no action |
| 7.5 | Extension survives restart | Restart browser with extension installed | Patterns and enabled state persist, listener re-registers |
| 7.6 | Storage change from another context | Edit storage in devtools → check background | `onChanged` listener picks up changes |
| 7.7 | File extension pattern | Pattern `\.(pdf\|docx?)$` → test URL ending `.pdf` | Matches correctly |

## 8. Cross-Browser
| # | Test Case | Steps | Expected |
|---|-----------|-------|----------|
| 8.1 | Chrome API path | Verify `chrome.history`, `chrome.storage.local` work | Functional |
| 8.2 | Firefox API path | Same test on Firefox | `browser.*` namespace works via the `api.ts` shim |
| 8.3 | Service worker lifecycle (Chrome) | Leave extension idle for 5 min → visit matching URL | Service worker wakes, `refreshCache()` runs, deletion works |
