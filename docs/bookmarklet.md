# Bookmarklet

One drag, and inspect-comment works on any page you can open, including sites
you do not control and cannot add a script tag to.

**Drag this to your bookmarks bar**, or make a new bookmark and paste it as the
URL:

```
javascript:(function()%7Bvar%20w%3Dwindow%2Cd%3Ddocument%3Bif(w.__inspectComment)%7Bw.__inspectComment.destroy()%3Breturn%7Dvar%20s%3Dd.createElement('script')%3Bs.src%3D'https%3A%2F%2Fcdn.jsdelivr.net%2Fgh%2Fpavlopuzikov%2Finspect-comment%40v2.1.0%2Fdist%2Finspect-comment.js'%3Bs.onerror%3Dfunction()%7Balert('inspect-comment%20could%20not%20load.%20This%20page%20blocks%20third-party%20scripts%20(CSP).%20Open%20the%20console%20and%20paste%20dist%2Finspect-comment.js%20instead.')%7D%3B(d.body%7C%7Cd.documentElement).appendChild(s)%7D)()
```

Click it once to mount the inspector, and again to remove it.

## What it actually does

It appends one `<script>` pointing at the committed IIFE build on jsDelivr,
pinned to v2.1.0:

```js
(function(){var w=window,d=document;if(w.__inspectComment){w.__inspectComment.destroy();return}var s=d.createElement('script');s.src='https://cdn.jsdelivr.net/gh/pavlopuzikov/inspect-comment@v2.1.0/dist/inspect-comment.js';s.onerror=function(){alert('inspect-comment could not load. This page blocks third-party scripts (CSP). Open the console and paste dist/inspect-comment.js instead.')};(d.body||d.documentElement).appendChild(s)})()
```

Nothing is sent anywhere. jsDelivr serves the file; the review stays in the page
and goes to your clipboard, or to your own machine over the MCP bridge.

## When it will not work

**Pages with a strict Content-Security-Policy.** A `script-src` that does not
allow `cdn.jsdelivr.net` blocks the injected tag, and the browser reports it
only in the console. The bookmarklet raises an alert saying so rather than
failing silently. Notable examples: GitHub, most banks, and anything behind an
enterprise CSP.

The way round it is the console paste, which no CSP can stop because it is not
a page resource:

1. Open DevTools, Console.
2. Paste the contents of [dist/inspect-comment.js](../dist/inspect-comment.js).

**`chrome://` and `about:` pages, the Chrome Web Store, and PDF viewers.**
Extensions cannot run there and neither can bookmarklets.

**Firefox and the bookmarks bar.** Firefox will run a `javascript:` bookmark
from the bar but not from the address bar, which is deliberate anti-phishing
behaviour and not a bug here.

## Keeping it current

The URL pins a version on purpose, so a bookmark saved today keeps behaving the
way it did today. Re-drag it after a release to move up. `npm run bookmarklet`
regenerates this file from `package.json`, and `npm run check` fails if the
committed copy has drifted.
