// Generates the bookmarklet in docs/bookmarklet.md.
//
// WHY a generator and not a hand-written string: the URL pins a version, so a
// hand-maintained one silently keeps serving an old build after a release. This
// derives it from package.json, and scripts/check.mjs re-runs it and fails if
// what is committed no longer matches, the same guarantee dist/ has.
//
//   node scripts/bookmarklet.mjs           write docs/bookmarklet.md
//   node scripts/bookmarklet.mjs --print   just print the URL

import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * The loader, as it will run in the page.
 *
 * DECISION: a loader, not the whole tool inlined. The IIFE build is ~88 kB;
 * Chrome and Firefox would both take that as a bookmark URL, but Safari's
 * limit is far lower and several bookmark managers truncate silently, which
 * fails as "the bookmarklet does nothing" with no way to tell why. A loader is
 * a few hundred bytes everywhere.
 *
 * Pressing it a second time removes the tool, because a bookmarklet has no
 * other off switch and mounting twice would leave an orphaned shadow host.
 */
export function loaderSource(version) {
  const url = `https://cdn.jsdelivr.net/gh/pavlopuzikov/inspect-comment@v${version}/dist/inspect-comment.js`;
  return [
    "(function(){",
    "var w=window,d=document;",
    "if(w.__inspectComment){w.__inspectComment.destroy();return}",
    "var s=d.createElement('script');",
    `s.src='${url}';`,
    // A CSP that forbids third-party scripts is the one failure mode with no
    // visible symptom at all: the element never executes and nothing is logged
    // anywhere the reviewer would look. Say so, and name the way round it.
    "s.onerror=function(){alert('inspect-comment could not load. This page blocks third-party scripts (CSP). Open the console and paste dist/inspect-comment.js instead.')};",
    "(d.body||d.documentElement).appendChild(s)",
    "})()",
  ].join("");
}

/** The full `javascript:` URL, encoded so bookmark managers keep it intact. */
export function bookmarklet(version) {
  return "javascript:" + encodeURIComponent(loaderSource(version));
}

export function page(version) {
  return `# Bookmarklet

One drag, and inspect-comment works on any page you can open, including sites
you do not control and cannot add a script tag to.

**Drag this to your bookmarks bar**, or make a new bookmark and paste it as the
URL:

\`\`\`
${bookmarklet(version)}
\`\`\`

Click it once to mount the inspector, and again to remove it.

## What it actually does

It appends one \`<script>\` pointing at the committed IIFE build on jsDelivr,
pinned to v${version}:

\`\`\`js
${loaderSource(version)}
\`\`\`

Nothing is sent anywhere. jsDelivr serves the file; the review stays in the page
and goes to your clipboard, or to your own machine over the MCP bridge.

## When it will not work

**Pages with a strict Content-Security-Policy.** A \`script-src\` that does not
allow \`cdn.jsdelivr.net\` blocks the injected tag, and the browser reports it
only in the console. The bookmarklet raises an alert saying so rather than
failing silently. Notable examples: GitHub, most banks, and anything behind an
enterprise CSP.

The way round it is the console paste, which no CSP can stop because it is not
a page resource:

1. Open DevTools, Console.
2. Paste the contents of [dist/inspect-comment.js](../dist/inspect-comment.js).

**\`chrome://\` and \`about:\` pages, the Chrome Web Store, and PDF viewers.**
Extensions cannot run there and neither can bookmarklets.

**Firefox and the bookmarks bar.** Firefox will run a \`javascript:\` bookmark
from the bar but not from the address bar, which is deliberate anti-phishing
behaviour and not a bug here.

## Keeping it current

The URL pins a version on purpose, so a bookmark saved today keeps behaving the
way it did today. Re-drag it after a release to move up. \`npm run bookmarklet\`
regenerates this file from \`package.json\`, and \`npm run check\` fails if the
committed copy has drifted.
`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { version } = JSON.parse(await readFile(join(root, "package.json"), "utf8"));
  if (process.argv.includes("--print")) {
    console.log(bookmarklet(version));
  } else {
    const out = join(root, "docs", "bookmarklet.md");
    await writeFile(out, page(version), "utf8");
    console.log(`wrote docs/bookmarklet.md for v${version} (${bookmarklet(version).length} chars)`);
  }
}
