# Changelog

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
