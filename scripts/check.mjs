// Dependency-free sanity checks, run in CI and before a release.
//
// The repo ships no test framework on purpose: the whole tool is one file with
// no dependencies, and the things most likely to break are structural rather
// than behavioural. These are the checks that would actually have caught a
// regression:
//
//   1. dist/ is regenerated from src/ and committed. It is the console-paste
//      path, so a stale artifact means the headline feature ships broken.
//   2. Every symbol src/inspect-comment.d.ts promises is really exported.
//      The types are hand-written, so nothing else keeps them honest.
//   3. The source stays dependency-free and side-effect-free on import.

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFile(join(root, ...p), "utf8");

const failures = [];
const fail = (msg) => failures.push(msg);
const ok = (msg) => console.log(`  ok   ${msg}`);

const src = await read("src", "inspect-comment.js");
const dts = await read("src", "inspect-comment.d.ts");
const pkg = JSON.parse(await read("package.json"));

/* 1. dist/ matches a fresh build ------------------------------------------ */

const { buildBundle } = await import("./build.mjs");
const fresh = buildBundle(src);
const committed = await read("dist", "inspect-comment.js").catch(() => null);

if (committed === null) {
  fail("dist/inspect-comment.js is missing. Run `npm run build`.");
} else if (committed !== fresh) {
  fail("dist/inspect-comment.js is stale. Run `npm run build` and commit the result.");
} else {
  ok("dist/inspect-comment.js matches src/");
}

/* 2. the hand-written types match the real exports ------------------------ */

const declared = [...dts.matchAll(/^export\s+(?:declare\s+)?function\s+(\w+)/gm)].map((m) => m[1]);
const exported = new Set([
  ...[...src.matchAll(/^export\s+(?:async\s+)?function\s+(\w+)/gm)].map((m) => m[1]),
  ...[...src.matchAll(/^export\s*\{([^}]*)\}/gm)].flatMap((m) =>
    m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop()).filter(Boolean)
  ),
]);

const missing = declared.filter((name) => !exported.has(name));
if (missing.length) fail(`declared in .d.ts but not exported by src/: ${missing.join(", ")}`);
else ok(`${declared.length} declared exports all exist (${declared.join(", ")})`);

/* 3. still dependency-free, still safe to import --------------------------- */

if (pkg.dependencies && Object.keys(pkg.dependencies).length) {
  fail("package.json gained a runtime dependency; the console-paste path assumes none.");
} else {
  ok("no runtime dependencies");
}

if (/^\s*import\s/m.test(src) || /\bimport\s*\(/.test(src)) {
  fail("src/inspect-comment.js gained an import; the bundler in scripts/build.mjs cannot inline it.");
} else {
  ok("core has no imports");
}

// mount() is called explicitly by every entry point. If the module ever mounts
// at import time it breaks SSR and the React wrapper's cleanup.
if (/^\s*mount\(\s*\)/m.test(src)) {
  fail("src/inspect-comment.js calls mount() at module scope; importing it must have no side effects.");
} else {
  ok("importing the core has no side effects");
}

/* ------------------------------------------------------------------------- */

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log("\nall checks passed");
