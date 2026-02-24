# Pristine History

A cross-browser WebExtension (Manifest V3) that automatically removes history entries for URLs matching user-defined regex patterns.

## How It Works

The addon listens for `history.onVisited` events and immediately calls `history.deleteUrl()` for any URL matching your configured patterns. Entries may appear briefly before removal — the WebExtensions API does not allow preventing history creation, only reacting to it.

> **Note:** `deleteUrl()` removes *all* visits for a matching URL, not just the latest one. This is by design for privacy tooling.

## Features

- **Regex-based URL matching** — define patterns to target specific sites, paths, or query parameters
- **Quick toggle** — enable/disable via the toolbar popup without removing your patterns
- **URL tester** — verify whether a URL matches your patterns from the options page
- **ReDoS protection** — patterns are validated against dangerous constructs (nested quantifiers, backreferences) before saving
- **Minimal permissions** — only requests `history` and `storage`

## Browser Compatibility

| Browser | Version | Status |
|---------|---------|--------|
| Chrome  | 102+    | ✅ Supported |
| Edge    | 102+    | ✅ Supported |
| Firefox | 121+    | ✅ Supported (MV3 service worker) |
| Chromium forks (Brave, Vivaldi, etc.) | MV3 support required | ✅ Supported |

## Development

### Prerequisites

- Node.js 18+
- `zip` command (for packaging only)

### Build

```bash
npm install
npm run build        # compile TypeScript → dist/
npm run typecheck    # type-check without emitting
npm run package      # build + create pristine-history.zip
npm run clean        # remove dist/ and zip
```

### Installation (from source)

Build first with `npm run build`, then load the `dist/` directory:

**Chrome / Edge / Chromium:**
1. Navigate to `chrome://extensions` (or `edge://extensions`)
2. Enable **Developer mode**
3. Click **Load unpacked** and select the `dist/` directory

**Firefox:**
1. Navigate to `about:debugging#/runtime/this-firefox`
2. Click **Load Temporary Add-on…**
3. Select `manifest.json` from the `dist/` directory

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

## File Structure

```
├── src/
│   ├── api.ts             # Browser API abstraction (Chrome/Firefox)
│   ├── background.ts      # Service worker — core history deletion logic
│   ├── regex-validator.ts  # Shared regex validation (ReDoS prevention)
│   ├── options.ts          # Pattern management UI logic
│   └── popup.ts            # Toolbar popup logic (toggle + status)
├── manifest.json          # Extension manifest (MV3)
├── options.html/css       # Pattern management UI
├── popup.html/css         # Toolbar popup UI
├── icons/                 # Extension icons
├── build.mjs              # esbuild build script
├── tsconfig.json          # TypeScript configuration
└── package.json           # Dependencies and scripts
```

## License

MIT
