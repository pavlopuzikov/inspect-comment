# inspect-comment

A dev-only element **inspector + comment queue** for web projects. Hit the hotkey,
click an element, type what should change, queue it. Walk the whole page, then
copy one markdown block that names every element precisely enough for a designer
or an AI coding agent to act on without guessing.

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
- **No install required.** It is one dependency-free file. Paste it into a console
  on a site you do not control, drop a script tag, or import the React wrapper.

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

Paste `dist/inspect-comment.js` into the browser console. It is a plain script
with no imports, so it also survives a strict CSP that blocks `import()`.

Where dynamic import is allowed, this one-liner is easier:

```js
import('https://cdn.jsdelivr.net/gh/pavlopuzikov/inspect-comment@master/src/inspect-comment.js').then(m => m.mount())
```

The same wrapped as a bookmarklet (make a new bookmark, paste as the URL):

```text
javascript:(()=>{import('https://cdn.jsdelivr.net/gh/pavlopuzikov/inspect-comment@master/src/inspect-comment.js').then(m=>m.mount())})()
```

## Keyboard

| Key | Does |
| --- | --- |
| `Alt` + `C` | Toggle inspect mode, from anywhere including mid-typing |
| `Alt` + click | Select an element directly, without arming inspect mode first |
| `Ctrl`/`⌘` + `Enter` | Queue the note and go straight back to inspecting |
| `Alt` + `↑` `↓` | Select the parent / first child of the current element |
| `Alt` + `←` `→` | Select the previous / next sibling |
| `Esc` | Close the panel, then leave inspect mode |

`elementFromPoint` returns the topmost node, so a click routinely lands on an
inner `<span>` when you meant the `<button>`. That is what the arrows are for.
The breadcrumb across the top of the panel does the same thing with the mouse.

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

**Component** — nearest components, outermost first. React including **Server
Components** (via `fiber._debugInfo`, which is where App Router names actually
live), Vue 3, Vue 2, and Angular. Falls back to `data-component`, then omits itself.
**Source** — `File.tsx:12` where the toolchain exposes it. Svelte always does;
React 19 dropped `_debugSource`, so treat it as a bonus there.
**Element** — tag, id, and any classes that are not framework utilities. Tailwind
variants (`sm:`, `hover:`), arbitrary values (`min-h-[calc(…)]`) and the utility
vocabulary are filtered out; if nothing meaningful survives, the class list is dropped.
**Section** — nearest `section[id]`, `[data-component]`, `main[id]`, or landmark.
**Text** — the element's own text nodes in preference to everything nested beneath
it, so selecting a section does not paste the whole page.
**Selector** — the *shortest* path that resolves to exactly one element, verified
with `querySelectorAll` and flagged `(not unique)` when it cannot be made so. An
XPath is added only in that case, as a fallback.
**Markup** — the opening tag, truncated.
**Box** — dimensions, padding, margin, gap, type, colours, radius. Only values
that are actually set.
**A11y** — role (explicit or implicit), accessible name (`aria-label`,
`aria-labelledby`, `title`), missing `alt`, `tabindex`, `disabled`, and the WCAG
contrast ratio against the nearest painted background, flagged when it fails AA
at that text size.
**Console** — errors, warnings, unhandled rejections and failed requests raised
while you were reviewing, appended once at the end of the block.

## Letting an agent read it without a copy-paste

The queue is mirrored into the page as JSON, so anything already driving the
browser (Playwright, chrome-devtools-mcp, a Puppeteer script) can read the whole
review in one call. No server, no port, nothing to keep running:

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
});

api.queue          // queued entries
api.logs           // captured console/network errors
api.markdown()     // what "Copy all" would put on the clipboard
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

## Development

```bash
npm run demo    # builds dist/, serves http://localhost:4321/demo/
npm run build   # regenerate dist/inspect-comment.js from src/
```

`demo/index.html` is deliberately hostile: aggressive CSS resets, sections with
no ids, repeated siblings, deep nesting, contrast failures, a missing `alt`, and
enough height to scroll. Use it to check a change before trusting it on a real project.

Edit `src/` only. `dist/` is generated and committed.

MIT licensed. Use it in every project.
