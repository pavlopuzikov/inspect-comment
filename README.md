# inspect-comment

A dev-only element **inspector + comment** tool for web projects. Toggle it on,
hover to highlight, click to select an element, type a comment, and hit **Copy**.
It copies one precise block:

```
Page: /work
Element: <button>.btn-outline.accent
Section: #work
Text: "View all work"
Selector: #work > div:nth-of-type(3) > a

Comment: find a different colour for these buttons
```

Paste that to a designer, a teammate, or an AI coding agent and it knows exactly
which element you mean and what to change. Built for design-review loops.

## Two ways to use it

### 1. Vanilla (any site, no build, no deps)

Drop the script in during development:

```html
<script src="/inspect-comment.js"></script>
```

…or paste the contents of [`vanilla/inspect-comment.js`](vanilla/inspect-comment.js)
straight into the browser console on any page. A button appears bottom-right.

- `InspectComment.config({ accent: '#3a4a5c', select: '#c23a12' })` — theme the outlines.
- `InspectComment.destroy()` — remove it.

Only load it in development (e.g. gate it behind `NODE_ENV`, a query flag, or a
bookmarklet) so it never ships to production.

### 2. React / Next.js

Copy [`react/DevInspector.tsx`](react/DevInspector.tsx) into your components and
mount it **only outside production**:

```tsx
// app/layout.tsx (Next.js App Router)
{process.env.NODE_ENV !== "production" && <DevInspector />}
```

The component is self-contained (React + inline styles, no other dependencies).

## What it captures

`Page` (pathname) · `Element` (tag + first classes) · `Section` (nearest
`section[id]`, `[data-component]`, landmark, or `main[id]`) · `Text` (trimmed,
≤100 chars) · `Selector` (a stable `nth-of-type` CSS path) · your `Comment`.

## Keyboard

- `Esc` — cancel inspect / close the comment panel
- `⌘/Ctrl + Enter` — copy from the comment box

## Notes

- The overlay sits at max `z-index` and ignores its own UI (`[data-inspector]`),
  so it never selects itself.
- Clipboard uses the async API with an `execCommand` fallback for non-secure
  contexts.

MIT licensed. Use it in every project.
