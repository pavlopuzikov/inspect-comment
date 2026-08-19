# inspect-comment

[![CI](https://github.com/pavlopuzikov/inspect-comment/actions/workflows/ci.yml/badge.svg)](https://github.com/pavlopuzikov/inspect-comment/actions/workflows/ci.yml)
[![MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![no dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)](package.json)

Click an element, say what should change, queue it. Walk the whole page, then
copy one markdown block that names every element precisely enough for a designer
or a coding agent to act on without guessing.

One dependency-free file. No account, no backend, no build step.

![Hover an element, click it, comment, queue it, copy the review](https://raw.githubusercontent.com/pavlopuzikov/inspect-comment/main/docs/media/the-loop.gif)

```markdown
# Review: /chapters/golden-era
Viewport 1440x900 @2x · 1 item

## 1. HomePage > ChaptersIndex > ChapterTeaserCard
- Element: `<a>.card-link`
- Source: `ChapterTeaserCard.tsx:41`
- Text: "Read the chapter"
- Selector: `#golden-era > div > a:nth-of-type(2)`
- Box: 320x64 · padding 16px 24px · 15px/1.2 600 Inter · bg #c23a12 · radius 999px
- A11y: role link · name "Read the chapter" · contrast 3.1:1 FAILS AA (needs 4.5)
- Focus: tab stop 7 of 24

**Suggested CSS:**
- `background-color`: #c23a12 → #8f2a0d

**Comment:** these read as buttons but behave as links, pick one
```

## Why this one

- **React Server Components.** Comparable tools walk the client fiber, which on a
  Next App Router page finds `SegmentViewNode` and nothing else, because a server
  component never gets a fiber. This reads `fiber._debugInfo` too.
- **Contrast and focus order, answered.** The two accessibility failures you
  cannot see in a screenshot, and the two a pass over the live DOM can settle.
- **The agent receives it.** The bundled [MCP server](mcp/README.md) delivers the
  review to Claude Code or Cursor. Others produce a ticket for a human.
- **Console and network errors ride along.** Half of "this looks wrong" is "this
  is broken", and the evidence is in a console the reviewer never opens.

## Install

**React / Next.js.** Copy `src/inspect-comment.js`, `src/inspect-comment.d.ts` and
`src/DevInspector.tsx` into your project, keeping them together, then gate the
**import**, not the render:

```tsx
// app/layout.tsx
const DevInspector =
  process.env.NODE_ENV === 'production'
    ? () => null
    : dynamic(() => import('@/components/dev/DevInspector').then((m) => m.DevInspector));
```

<details>
<summary>Do not use <code>{process.env.NODE_ENV !== 'production' &amp;&amp; &lt;DevInspector /&gt;}</code></summary>

It is the obvious pattern and it does not work. The guard removes the *render*,
but a `"use client"` module reaches the client graph through the static import
regardless, so the whole tool is still emitted as a client chunk and referenced
by every prerendered page. Measured on Next 16 with Turbopack: 22 kB of dev
tooling shipped to production. The dynamic import above sits in a branch that
constant-folds away and leaves nothing behind.

To check: `npm run build && grep -rl "data-inspect-comment" .next/static` should
print nothing.

Omit `{ ssr: false }`. It is not allowed from a Server Component and the build
will fail, and it is unnecessary here anyway.
</details>

**Script tag.** `<script type="module" src="/auto.js"></script>`, safe in
`<head>` without `defer`.

**Any site you do not control.** A [bookmarklet](docs/bookmarklet.md): one drag,
then one click. Where a strict CSP blocks it, paste `dist/inspect-comment.js`
into the console instead; no CSP can stop that, because it is not a page resource.

## Keyboard

| Key | Does |
| --- | --- |
| `Alt` + `C` | Toggle inspect mode, from anywhere including mid-typing |
| `Alt` + click | Select an element directly, without arming inspect mode |
| `Tab` / `Shift`+`Tab` | Walk the page's focus order |
| `↑` `↓` `←` `→` | Walk the tree: parent, first child, siblings |
| `Enter` | Select the highlighted element |
| `Ctrl`/`⌘` + `Enter` | Queue the note and go straight back to inspecting |
| `Alt` + `F` | Show the focus-order overlay |
| `Esc` | Close the panel, then leave inspect mode |

Inspect mode owns the keyboard, so the tool works with no pointer at all. Outside
it, hold `Alt` with the arrows. `elementFromPoint` returns the topmost node, so a
click routinely lands on an inner `<span>` when you meant the `<button>`; that is
what the arrows and the panel's breadcrumb are for.

## What a note carries

| | |
| --- | --- |
| **Component** | Nearest components, outermost first. React (incl. Server Components), Vue 2/3, Angular. |
| **Source** | `File.tsx:12` where the toolchain exposes it. Svelte always does. |
| **Element** | Tag, id, and classes that are not framework utilities. Tailwind's vocabulary is filtered out. |
| **Selector** | The *shortest* path resolving to exactly one element, verified. An XPath only when it cannot be made unique. |
| **Box** | Dimensions, padding, margin, gap, type, colours, radius. Only what is actually set. |
| **A11y** | Role, accessible name, missing `alt`, and the WCAG contrast ratio against the nearest painted background, flagged when it fails AA. |
| **Focus** | Position in the real tab order, a `tabindex` that overrides it, or a click handler the keyboard cannot reach. |
| **CSS** | Press **CSS** for ten editable properties. Type a value, the page updates, the note records `from → to`. **Copy all** puts the page back. |
| **Screenshot** | Press **Shot** for a PNG of the element as painted, via the Screen Capture API rather than a DOM rasteriser. |

`Alt`+`F` draws the tab order over the page, numbered in the order the browser
will visit each stop, amber where the keyboard position disagrees with the visual
one. Walking it never calls `focus()`, so reviewing the order does not disturb
the page.

## Handing it to an agent

If the agent has no browser (Claude Code, Cursor), give it the MCP server. Copying
a review then also delivers it, and `await_review` blocks while you mark the page
up. Setup and troubleshooting: [mcp/README.md](mcp/README.md).

```bash
claude mcp add inspect-comment -- npx -y inspect-comment-mcp
```

If it does have one (Playwright, chrome-devtools-mcp), read the queue out of the
page, with no server at all:

```js
JSON.parse(document.getElementById('inspect-comment-queue').textContent)
```

## API

```js
import { mount } from './inspect-comment.js';

const api = mount({
  accent: '#3a4a5c',                // hover outline
  select: '#c23a12',                // selected outline
  hotkey: 'KeyC',                   // KeyboardEvent.code, used with Alt
  storage: true,                    // persist the queue to sessionStorage
  capture: true,                    // capture console + network errors
  expose: true,                     // mirror the queue into the page as JSON
  screenshots: true,                // offer the per-note Shot button
  bridge: 'http://127.0.0.1:7391',  // MCP server; false to disable
});

api.markdown()     // what "Copy all" would copy
api.focusOrder()   // every tab stop, in the order the browser will visit them
api.send()         // push the queue to the MCP server
api.resetStyles()  // revert live CSS edits, keep the queue
api.destroy()      // full teardown: UI, listeners, console/fetch, edits, JSON tag
// also: api.queue, api.logs, api.bridge, api.config({ accent: '#0a7' })
```

`mount()` is idempotent and exposes the instance as `window.InspectComment`.
`describe(el)` and `toMarkdown(entries)` are exported separately, so the capture
logic works with no UI.

## Keep it out of production

It reads the page aggressively and is not built to be defensive about what it finds.

- The `Markup` line is the element's opening tag, attributes included. Inspecting
  a populated form field puts that field's `value` into the note.
- `capture: true` records `console.error`, `console.warn` and failed responses.
  Applications routinely log tokens and user records. Read a review before sending
  it on, or run with `capture: false`.
- `expose: true` mirrors the queue into the DOM, where any script on the page can
  read it. Pass `expose: false` on a page running third-party scripts.
- The queue sits in `sessionStorage` in the clear until you copy or clear it.

None of this matters on your own dev server, which is the point. All of it matters
on a production site or a client's staging environment.

## Development

```bash
npm run demo    # builds dist/, serves http://localhost:4321/demo/
npm test        # contrast maths and the MCP server, on node --test
npm run check   # dist/ in sync, .d.ts matches the exports, still dependency-free
```

Edit `src/` only. `dist/` is generated and committed, and CI fails if the two have
drifted. `demo/index.html` is deliberately hostile: aggressive resets, sections
with no ids, repeated siblings, contrast failures, a missing `alt`, and focus-order
traps.

MIT licensed. Use it in every project.
