# Changelog

## 2.1.0

### Added

- **MCP server** (`mcp/server.mjs`, `npx inspect-comment-mcp`). Copying a review
  also posts it to a loopback port, and a coding agent reads it with a tool call
  instead of the reviewer pasting it. `await_review` blocks until you send one,
  so "go and mark up the page, I'll wait" works literally. The JSON-RPC is
  hand-rolled against `node:` builtins, so the repo is still dependency-free.
- **Focus-order review.** `Alt`+`F` draws the page's real tab order over it,
  numbered, with a positive `tabindex` marked and out-of-order stops flagged. The
  sequence follows the HTML spec rather than document order, and walking it never
  calls `focus()`, so reviewing the order does not disturb the page. Each note
  carries the element's position.
- **Keyboard-driven selection.** Inspect mode takes the keyboard: `Tab` walks the
  focus order, bare arrows walk the tree, `Enter` selects. The tool is now usable
  without a pointer, which it had no business not being.
- **Per-note screenshots.** `Shot` attaches a PNG of the element as the browser
  painted it, via the Screen Capture API rather than a DOM rasteriser, so it adds
  nothing to the bundle and does not disagree with the browser on transforms,
  blend modes or canvas content. The MCP server writes each one to disk and the
  note cites the path.
- **Bookmarklet** (`docs/bookmarklet.md`), generated from `package.json` and
  version-checked in CI, so "no install required" is finally one drag.

### Fixed

- `Add ⌘⏎` hardcoded the Mac glyph, so every Windows and Linux reviewer read a
  shortcut they did not have.

## 2.0.0

First public release.

### Added

- **Comment queue.** Walk a whole page, queue a note per element, then copy one
  markdown block. Previously every comment was a separate copy.
- **React Server Component names**, read from `fiber._debugInfo`. Walking the
  client fiber alone finds only Next's own boundaries on an App Router page.
- **WCAG contrast**, computed against the nearest painted ancestor background and
  flagged when it fails AA at the element's text size.
- **Live CSS editing.** Ten computed properties become editable inputs; the page
  updates as you type and each change is recorded on the note as `from → to`.
  `Copy all` reverts the page.
- **Console and network capture.** Errors, warnings, unhandled rejections and
  failed responses raised during the review are appended to the block.
- **Vue 2/3, Angular and Svelte** component and source detection.
- **Queue exposed as JSON** in the page, so a browser-driving agent can read a
  review without a copy-paste step. `expose: false` opts out.
- **Alt+arrow tree walking** and a breadcrumb, because `elementFromPoint` lands
  on the inner `<span>` when you meant the `<button>`.
- `sessionStorage` persistence, so a Fast Refresh mid-review keeps the queue.
- Hand-written TypeScript definitions.
- `dist/inspect-comment.js`, a committed IIFE build for the console-paste path.

### Changed

- **One implementation.** `vanilla/inspect-comment.js` and `react/DevInspector.tsx`
  were two full copies that had already diverged after a single commit (different
  traversal depth, one missing the clipboard fallback). Both are now thin wrappers
  over `src/inspect-comment.js`.
- **The UI moved into a shadow root.** `all: initial` on a plain div protected the
  root element but not its descendants, so Tailwind preflight reached the buttons.
- **Selectors are now the shortest path that resolves uniquely**, verified with
  `querySelectorAll` and flagged `(not unique)` when no such path exists, instead
  of a fixed depth of `div > div > div`.
- Tailwind utility classes are filtered out of the element label.
- The highlight tracks its element through scroll and layout shift, rather than
  being positioned once at click time.

### Fixed

- Options passed as explicitly `undefined` (which is what the React wrapper does
  with unset props) clobbered the defaults, silently disabling the hotkey and
  queue persistence.
- `mount()` at import time appended to `document.body` before it existed when the
  script was loaded from `<head>` without `defer`.
- Describing a `<section id="x">` reported `Section: #x` for the section itself.
- Captured console entries leaked across a `destroy()` / `mount()` cycle, so a
  remount attributed earlier errors to a review that had not started.

## 1.0.0

Initial version. Single-element inspect and comment, copied one note at a time,
shipped as a vanilla script and a separate React component.
