# inspect-comment

[![CI](https://github.com/pavlopuzikov/inspect-comment/actions/workflows/ci.yml/badge.svg)](https://github.com/pavlopuzikov/inspect-comment/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![no dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)

A dev-only element **inspector + comment queue** for web projects. Hit the hotkey,
click an element, type what should change, queue it. Walk the whole page, then
copy one markdown block that names every element precisely enough for a designer
or an AI coding agent to act on without guessing.

![Hover an element, click it, comment, queue it, copy the review](https://raw.githubusercontent.com/pavlopuzikov/inspect-comment/main/docs/media/the-loop.gif)

```markdown
# Review: /chapters/golden-era
Viewport 1440x900 @2x · 2 items

## 1. HomePage > ChaptersIndex > ChapterTeaserCard
- Element: `<a>.card-link`
- Source: `ChapterTeaserCard.tsx:41`
- Section: #golden-era
- Text: "Read the chapter"
- Selector: `#golden-era > div > a:nth-of-type(2)`
- Markup: `<a class="card-link group relative" href="/chapters/golden-era">`
- Box: 320x64 · padding 16px 24px · 15px/1.2 600 Inter · color #f6f5f1 · bg #c23a12 · radius 999px
- A11y: role link · name "Read the chapter" · contrast 3.1:1 FAILS AA (needs 4.5)

**Suggested CSS:**
- `background-color`: #c23a12 → #8f2a0d
- `padding`: 16px 24px → 18px 28px

**Comment:** these read as buttons but behave as links, pick one

## 2. HomePage > Hero > CrestMark
- Element: `<svg>`
- Selector: `header > svg`
- Box: 48x48 · margin 0 0 24px · color #c23a12

**Comment:** crest is too small against the headline

## Console (2)
- `error` Hydration failed because the server rendered HTML didn't match the client
- `network` 404 /assets/crest/1925.svg
```

Everything above is captured for you. You type the comment and, optionally, dial
the CSS values.

## Why this one

The space is crowded. What is actually different here:

- **React Server Components.** Every comparable tool walks the client fiber, which
  on a Next App Router page finds `SegmentViewNode` and nothing else, because a
  server component never gets a fiber. This reads `fiber._debugInfo` too, so you
  get `HomePage > Hero` on a page where the alternatives get nothing.
- **WCAG contrast, computed and flagged.** "Is this readable" is one of the few
  design-review questions with a right answer, so it gets answered rather than argued.
- **Live CSS editing that records itself.** Change the value, see the page update,
  and the note carries `font-size: 172.8px → 140px` instead of "a bit smaller".
- **Console and network errors ride along.** Half of "this looks wrong" is "this is
  broken", and the evidence is in a console the reviewer never opens.
- **The agent receives it, rather than being handed it.** The bundled
  [MCP server](mcp/README.md) delivers the review to Claude Code or Cursor
  directly. `await_review` even blocks while you mark the page up. Comparable
  tools produce a ticket for a human; this produces a brief for an agent.
- **Focus order, drawn on the page.** Contrast and focus order are the two
  accessibility failures invisible in a screenshot, and the two a pass over the
  live DOM can actually settle. Both are answered here.
- **No install required, and it means it.** One dependency-free file. A
  bookmarklet on any site you can open, a console paste where a CSP blocks that,
  a script tag, or the React wrapper.

### What one click captures

![Every field a single click fills in](https://raw.githubusercontent.com/pavlopuzikov/inspect-comment/main/docs/media/one-click.gif)

### Why Server Components are the hard part

![Walking the client fiber finds nothing; _debugInfo names the server component](https://raw.githubusercontent.com/pavlopuzikov/inspect-comment/main/docs/media/server-components.gif)

Source for all three is in [docs/animations](docs/animations), rendered with Manim.

## Install

Three paths, one implementation. `src/inspect-comment.js` is the whole tool;
everything else wraps it.

### 1. React / Next.js

Copy `src/inspect-comment.js`, `src/inspect-comment.d.ts` and `src/DevInspector.tsx`
into your project, keeping them in the same folder, then gate the **import**, not
the render:

```tsx
// app/layout.tsx
import dynamic from 'next/dynamic';

const DevInspector =
  process.env.NODE_ENV === 'production'
    ? () => null
    : dynamic(() => import('@/components/dev/DevInspector').then((m) => m.DevInspector));

// ...then render <DevInspector /> unconditionally inside <body>.
```

TypeScript needs no config: the `.d.ts` types the `.js` core.

> **Do not use `{process.env.NODE_ENV !== 'production' && <DevInspector />}`.**
> It is the obvious pattern and it does not work. The guard removes the *render*,
> but a `"use client"` module reaches the client graph through the static import
> regardless, so the whole tool is still emitted as a client chunk and referenced
> by every prerendered page. Measured on Next 16 with Turbopack: 22 kB of dev
> tooling shipped to production. The dynamic import above sits in a branch that
> constant-folds away, and leaves nothing behind (verified by grepping the build
> output for every identifier in the tool).
>
> If you use that pattern, check before trusting it:
> `npm run build && grep -rl "data-inspect-comment" .next/static` should print nothing.

Omit `{ ssr: false }`: it is not allowed from a Server Component and the build
will fail. It is unnecessary here anyway, since the component renders `null` and
only does work in an effect.

### 2. Script tag

```html
<script type="module" src="/auto.js"></script>
```

Safe in `<head>` without `defer`; the core waits for `document.body` itself.

### 3. Any site you do not control

A **bookmarklet**, so it is one drag and then one click on any page you can
open. The URL and the caveats are in [docs/bookmarklet.md](docs/bookmarklet.md);
click it once to mount, again to remove.

Where a strict CSP blocks the injected script, paste
`dist/inspect-comment.js` into the browser console instead. It is a plain script
with no imports, so no CSP can stop it: it is not a page resource.

## Keyboard

| Key | Does |
| --- | --- |
| `Alt` + `C` | Toggle inspect mode, from anywhere including mid-typing |
| `Alt` + click | Select an element directly, without arming inspect mode first |
| `Ctrl`/`⌘` + `Enter` | Queue the note and go straight back to inspecting |
| `Alt` + `↑` `↓` | Select the parent / first child of the current element |
| `Alt` + `←` `→` | Select the previous / next sibling |
| `Tab` / `Shift`+`Tab` | Walk the page's focus order (in inspect mode) |
| `Enter` | Select the highlighted element (in inspect mode) |
| `↑` `↓` `←` `→` | Walk the tree, no modifier needed (in inspect mode) |
| `Alt` + `F` | Show the focus-order overlay |
| `Esc` | Close the panel, then leave inspect mode |

`elementFromPoint` returns the topmost node, so a click routinely lands on an
inner `<span>` when you meant the `<button>`. That is what the arrows are for.
The breadcrumb across the top of the panel does the same thing with the mouse.

Inspect mode takes the keyboard, which is what makes the tool usable without a
pointer at all: arm it, `Tab` to the control you mean, `Enter`, type, `Ctrl`+`Enter`.

## Focus order

`Alt`+`F` draws the page's tab order over it, numbered in the order the browser
will actually visit each stop. A `!` marks a positive `tabindex`, and amber marks
a stop whose keyboard position disagrees with where it sits on screen.

The sequence is the real one from the HTML spec, not document order: a positive
`tabindex` jumps the queue, ascending, and only then does everything at
`tabindex="0"` follow. Selecting an element puts its position on the note:

```
- Focus: tab stop 1 of 8 · tabindex 3 OVERRIDES document order
```

Walking with `Tab` never calls `focus()` on the page's own elements, so nothing
opens, scrolls or dismisses while you look at it.

Two things this deliberately does not do. It does not flag every element after a
displaced one: the overlay marks the *minimum* set you would have to move
(the complement of the longest run already in agreement), because comparing
positions directly turns one bad `tabindex` into a page-wide red alert. And it
does not model the separate navigation scopes an open `<dialog>` or a shadow
root create, so treat those as out of scope rather than as reported-correctly.

## Screenshots

Press **Shot** in the comment panel to attach a PNG of the element as the
browser actually painted it. The first one asks for screen-capture permission;
the rest of the session does not.

It uses the Screen Capture API rather than a DOM-to-canvas rasteriser, so
`backdrop-filter`, blend modes, transforms, `<canvas>` and WebGL all come out
right, and it adds nothing to the bundle. html2canvas would have been 150-200 kB
and would disagree with the browser on exactly the things a design review is
about.

Chrome puts "This tab" first in the picker. Other browsers show the normal
picker; pick the tab.

Images travel over the [MCP bridge](mcp/README.md), not the clipboard: the
server writes each one to disk and the note cites the path.

## Live CSS editing

Press **CSS** in the panel to reveal ten editable properties, prefilled with the
element's computed values: size, weight, line-height, tracking, colour,
background, padding, margin, gap, radius.

Type a value and the page updates immediately, so you can dial in the change
rather than describe it. Each edited property is recorded on the note as a
`from → to` pair. Text fields, not colour pickers, so you can paste a design
token (`var(--gold)`) as easily as a hex value.

Edits stay applied while you keep reviewing, so changes accumulate visually.
**Copy all** puts the page back exactly as it was and hands the values off in the
markdown. `api.resetStyles()` reverts them at any time, and so does `destroy()`.

## What it captures

**Component**: nearest components, outermost first. React including **Server
Components** (via `fiber._debugInfo`, which is where App Router names actually
live), Vue 3, Vue 2, and Angular. Falls back to `data-component`, then omits itself.
**Source**: `File.tsx:12` where the toolchain exposes it. Svelte always does;
React 19 dropped `_debugSource`, so treat it as a bonus there.
**Element**: tag, id, and any classes that are not framework utilities. Tailwind
variants (`sm:`, `hover:`), arbitrary values (`min-h-[calc(…)]`) and the utility
vocabulary are filtered out; if nothing meaningful survives, the class list is dropped.
**Section**: nearest `section[id]`, `[data-component]`, `main[id]`, or landmark.
**Text**: the element's own text nodes in preference to everything nested beneath
it, so selecting a section does not paste the whole page.
**Selector**: the *shortest* path that resolves to exactly one element, verified
with `querySelectorAll` and flagged `(not unique)` when it cannot be made so. An
XPath is added only in that case, as a fallback.
**Markup**: the opening tag, truncated.
**Box**: dimensions, padding, margin, gap, type, colours, radius. Only values
that are actually set.
**A11y**: role (explicit or implicit), accessible name (`aria-label`,
`aria-labelledby`, `title`), missing `alt`, `tabindex`, `disabled`, and the WCAG
contrast ratio against the nearest painted background, flagged when it fails AA
at that text size.
**Focus**: position in the page's real tab order, a positive `tabindex` that
overrides document order, a focusable control with no accessible name, or a
click handler on something the keyboard cannot reach at all.
**Screenshot**: a PNG of the element as painted, when you asked for one.
**Console**: errors, warnings, unhandled rejections and failed requests raised
while you were reviewing, appended once at the end of the block.

## Handing the review to a coding agent

Two ways, depending on whether the agent has a browser.

### It does not: the MCP server

Most of the time the agent is Claude Code or Cursor in a terminal. Point it at
the bundled MCP server and pressing **Copy all** also delivers the review to it.

```bash
claude mcp add inspect-comment -- npx -y inspect-comment-mcp
```

Then `get_review` hands over your notes, and `await_review` blocks until you send
them, so "go and mark up the page, I'll wait" works literally. Setup, tools and
troubleshooting are in [mcp/README.md](mcp/README.md).

It is a loopback port on your own machine. No account, no hosted service,
nothing leaves the box, and the server has no dependencies either.

### It does: read the queue out of the page

Anything already driving the browser (Playwright, chrome-devtools-mcp, a
Puppeteer script) can read the whole review in one call, with no server at all:

```js
JSON.parse(document.getElementById('inspect-comment-queue').textContent)
```

Each entry is `{ descriptor, comment, changes }`. Pass `expose: false` to turn it off.

## API

```js
import { mount, unmount, describe, toMarkdown } from './inspect-comment.js';

const api = mount({
  accent: '#3a4a5c',   // hover outline
  select: '#c23a12',   // selected outline
  hotkey: 'KeyC',      // KeyboardEvent.code, used with Alt
  storage: true,       // persist the queue to sessionStorage
  capture: true,       // capture console + network errors
  expose: true,        // mirror the queue into the page as JSON
  bridge: 'http://127.0.0.1:7391',  // MCP server; false to disable
  screenshots: true,   // offer the per-note Shot button
});

api.queue          // queued entries
api.logs           // captured console/network errors
api.markdown()     // what "Copy all" would put on the clipboard
api.focusOrder()   // every tab stop, in the order the browser will visit them
api.bridge         // the MCP server origin if one is answering, else null
api.send()         // push the queue to the MCP server
api.resetStyles()  // revert live CSS edits, keep the queue
api.config({ accent: '#0a7' })
api.destroy()      // full teardown: UI, listeners, console/fetch, edits, JSON tag
```

`mount()` is idempotent and also exposes the instance as `window.InspectComment`.
`describe(el)` and `toMarkdown(entries)` are exported separately so the capture
logic can be used without any UI.

## Notes

- The queue survives a reload via `sessionStorage`, so a Fast Refresh in the
  middle of a review does not throw away half your notes. Pass `storage: false`
  to opt out.
- Everything already queued keeps a numbered badge on the page, and the enclosing
  section is outlined while you hover or select, so the whole review stays visible.
- The UI lives in a shadow root, so host-page CSS cannot reach it. Tailwind
  preflight resetting every `button` on the page is the common case.
- While the comment panel is open, clicks on the page are swallowed. A stray
  click on a link would otherwise navigate away and take an unsent comment with it.
- `capture: true` wraps `console.error`, `console.warn` and `fetch`. All three are
  restored by `destroy()`. Pass `capture: false` if that is not acceptable.
- Clipboard writes fall back to `execCommand` on non-secure origins, which is
  what you get previewing a dev server from a phone over the LAN IP.
- The toggle button drags to a new corner, and remembers where you put it.

## Scope, and what not to do with it

This is a development tool. It reads the page aggressively and is not built to
be defensive about what it finds, so keep it out of production:

- The captured `Markup` line is the element's opening tag, attributes included.
  Inspecting a populated form field puts that field's `value` into the note.
- `capture: true` records `console.error`, `console.warn` and failed responses.
  Applications routinely log tokens and user records to the console, and those
  end up in the markdown you are about to paste somewhere. Read a review block
  before sending it on, or run with `capture: false`.
- `expose: true` mirrors the queue into the DOM, where any script on the page
  can read it. Pass `expose: false` on a page running third-party scripts.
- The queue lives in `sessionStorage` under `inspect-comment:queue`, in the
  clear, until you copy or clear it.

None of this matters on your own dev server, which is the intended use. All of
it matters on a production site or a client's staging environment.

## Development

```bash
npm run demo    # builds dist/, serves http://localhost:4321/demo/
npm run build   # regenerate dist/inspect-comment.js from src/
npm run check   # dist/ is in sync, .d.ts matches the real exports, still dep-free
```

`demo/index.html` is deliberately hostile: aggressive CSS resets, sections with
no ids, repeated siblings, deep nesting, contrast failures, a missing `alt`, and
enough height to scroll. Use it to check a change before trusting it on a real project.

Edit `src/` only. `dist/` is generated and committed, and CI fails if the two
have drifted, so run `npm run build` in the same commit as any change to `src/`.

MIT licensed. Use it in every project.
