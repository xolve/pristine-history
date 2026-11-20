# Pristine History

A Firefox WebExtension (Manifest V3) that automatically removes history entries for URLs matching user-defined regex patterns.

## Features

- **Regex-based URL matching** — define patterns to target specific sites, paths, or query parameters
- **Quick toggle** — enable/disable via the toolbar popup without removing your patterns
- **URL tester** — verify whether a URL matches your patterns from the options page
- **ReDoS protection** — patterns are validated against dangerous constructs (nested quantifiers, backreferences) before saving
- **Minimal permissions** — only requests `history` and `storage`

## Browser Compatibility

Firefox is the current target. The build uses `background.scripts` in its Manifest V3 manifest. This repository does not produce a build for Chrome, Edge, or other Chromium browsers.

## Usage

1. Click the Pristine History icon in the toolbar to toggle on/off
2. Click **Manage Patterns** (or right-click → Options) to open the options page
3. Add regex patterns that match URLs you want removed from history
4. Use the **Test a URL** section to verify your patterns work as expected

### Example Patterns

| Pattern | Matches |
|---------|---------|
| `^https://(www\.)?example\.com/` | All pages on example.com |
| `\.(pdf\|docx?)$` | URLs ending in .pdf, .doc, or .docx |
| `[?&]utm_` | URLs with UTM tracking parameters |
| `^https://mail\.google\.com/` | Gmail |

## What It Does NOT Affect

- **Bookmarks** — only the `history` API is used; bookmarks are untouched
- **Downloads** — download history is managed separately by the browser
- **Other extensions** — the addon only deletes specific URLs via `deleteUrl()`; it does not use `deleteAll()` or `deleteRange()`

> **Caveat:** Extensions that observe `history.onVisitRemoved` will see removal events triggered by this addon. This is unavoidable but has no functional impact on well-behaved extensions.

## Regex Safety

User-provided patterns are validated before saving:

- Maximum pattern length: **500 characters**
- Maximum pattern count: **50**
- **Rejected constructs** (ReDoS prevention):
  - Nested quantifiers like `(a+)+` or `(a*)*`
  - Backreferences like `\1`
  - Overlapping alternation with quantifiers like `(.*|.*)+`
- Invalid regex syntax is caught at compile time
