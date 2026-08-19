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
//   4. The bookmarklet in docs/ still points at the version being shipped.
//   5. The MCP server neither imports a package nor writes to stdout, which are
//      the two ways a stdio server fails with no diagnosable symptom.
//   6. The README still describes the code. It is the only user-facing doc, so
//      when it drifts there is nothing else to correct it.

import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (...p) => readFile(join(root, ...p), "utf8");

const failures = [];
const fail = (msg) => failures.push(msg);
const ok = (msg) => console.log(`  ok   ${msg}`);

const src = await read("src", "inspect-comment.js");
const dts = await read("src", "inspect-comment.d.ts");
const mcp = await read("mcp", "server.mjs");
const readme = await read("README.md");
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

/* 4. the bookmarklet matches the version in package.json ------------------- */

const { page: bookmarkletPage } = await import("./bookmarklet.mjs");
const freshBookmarklet = bookmarkletPage(pkg.version);
const committedBookmarklet = await read("docs", "bookmarklet.md").catch(() => null);

if (committedBookmarklet === null) {
  fail("docs/bookmarklet.md is missing. Run `npm run bookmarklet`.");
} else if (committedBookmarklet.replace(/\r\n/g, "\n") !== freshBookmarklet) {
  fail(`docs/bookmarklet.md does not match v${pkg.version}. Run \`npm run bookmarklet\`.`);
} else {
  ok(`bookmarklet pinned to v${pkg.version}`);
}

/* 5. the MCP server is still a clean stdio server -------------------------- */

// Anything on stdout that is not a JSON-RPC message corrupts the stream, and
// the client reports it as a parse error naming nothing. This is the single
// easiest way to break an MCP server, and a stray console.log looks harmless.
const stdoutWrites = [...mcp.matchAll(/console\.(log|info|debug)\s*\(/g)];
if (stdoutWrites.length) {
  fail(`mcp/server.mjs writes to stdout (${stdoutWrites.length}x console.log/info/debug); use log() for stderr.`);
} else {
  ok("MCP server keeps stdout for JSON-RPC only");
}

// The server ships inside the npm package, so a bare import there is a runtime
// dependency by another name and the zero-dependency claim stops being true.
const bareImports = [...mcp.matchAll(/^import\s[^;]*?from\s+["']([^"']+)["']/gm)]
  .map((m) => m[1])
  .filter((spec) => !spec.startsWith("node:") && !spec.startsWith("."));
if (bareImports.length) {
  fail(`mcp/server.mjs imports a package: ${bareImports.join(", ")}`);
} else {
  ok("MCP server uses only node: builtins");
}

if (!pkg.files.includes("mcp/")) {
  fail("package.json `files` omits mcp/, so `npx inspect-comment-mcp` would resolve to nothing.");
} else {
  ok("mcp/ is published");
}

/* 6. the README still matches the code ------------------------------------- */

// WHY this is worth a check: the documented mount() call had every option after
// the first laid out in columns, which put four of the eight inside a trailing
// // comment. It parsed, it read correctly, and copy-pasting it silently gave
// you half the options. Prose drift is survivable; a broken example is not.
const defaults = src.slice(src.indexOf("const DEFAULTS"), src.indexOf("// Live-editable"));
const optionKeys = [...defaults.matchAll(/^ {2}(\w+):/gm)].map((m) => m[1]);
const example = readme.slice(readme.indexOf("const api = mount({"), readme.indexOf("api.markdown()"));

if (!example) {
  fail("README no longer contains a `const api = mount({ ... })` example.");
} else {
  try {
    const literal = example.slice(example.indexOf("{"), example.lastIndexOf("}") + 1);
    const evaluated = Object.keys(new Function(`return (${literal})`)());
    const lost = optionKeys.filter((k) => !evaluated.includes(k));
    if (lost.length) fail(`README mount() example evaluates without: ${lost.join(", ")}`);
    else ok(`README documents all ${optionKeys.length} options and the example evaluates`);
  } catch (err) {
    fail(`README mount() example does not parse: ${err.message}`);
  }
}

// Every api.x named in the README has to exist on the object createInspector
// returns, or the first thing a reader tries throws.
const returned = src.slice(src.lastIndexOf("  return {"));
const phantom = [...readme.matchAll(/^api\.(\w+)/gm)]
  .map((m) => m[1])
  .filter((name) => !new RegExp(`(get )?${name}\\b`).test(returned));
if (phantom.length) fail(`README documents api members that do not exist: ${phantom.join(", ")}`);
else ok("every api.* in the README exists");

const dead = [...readme.matchAll(/\]\((?!https?:|#)([^)]+)\)/g)]
  .map((m) => m[1].split("#")[0])
  .filter((target) => !existsSync(join(root, target)));
if (dead.length) fail(`README has dead relative links: ${dead.join(", ")}`);
else ok("README relative links resolve");

if (readme.includes("\u2014")) fail("em dash in README");

/* ------------------------------------------------------------------------- */

if (failures.length) {
  console.error(`\n${failures.length} check(s) failed:`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  process.exit(1);
}
console.log("\nall checks passed");
