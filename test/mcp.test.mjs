// The MCP server, covered at both layers:
//
//   1. the tool layer, imported directly (IC_MCP_LIB=1 keeps it from binding a
//      port or holding stdin open),
//   2. the wire, by spawning the real thing and speaking JSON-RPC to it.
//
// The wire tests are the ones that matter. The protocol is hand-rolled to keep
// the repo dependency-free, and a hand-rolled protocol that is only unit-tested
// is a protocol nobody has ever actually spoken. Every failure mode here is one
// that presents to the user as "the MCP server shows no tools", with no error
// anywhere to explain it.

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const SERVER = fileURLToPath(new URL("../mcp/server.mjs", import.meta.url));

process.env.IC_MCP_LIB = "1";
const dir = await mkdtemp(join(tmpdir(), "ic-mcp-test-"));
process.env.IC_MCP_DIR = dir;

const { __test } = await import("../mcp/server.mjs");
const { callTool, addReview, linkShots, TOOLS, reset } = __test;

const body = (result) => result.content.map((c) => c.text).join("");

/* -------------------------------------------------------------- tool layer */

test("get_review reports the absence as a failure the model can act on", async () => {
  reset();
  const r = await callTool("get_review");
  assert.equal(r.isError, true);
  assert.match(body(r), /await_review/, "should name the tool that waits");
});

test("a posted review comes back as its markdown", async () => {
  reset();
  addReview({ page: "/pricing", markdown: "# Review\n\n## 1. <button>", queue: [{}, {}] });
  assert.match(body(await callTool("get_review")), /## 1\. <button>/);
});

test("json format returns the structured queue, not the prose", async () => {
  reset();
  addReview({ markdown: "# Review", queue: [{ comment: "too tight" }] });
  const parsed = JSON.parse(body(await callTool("get_review", { format: "json" })));
  assert.equal(parsed.queue[0].comment, "too tight");
  assert.equal(parsed.markdown, undefined, "the markdown is redundant in this format");
});

test("reviews are addressable by id, newest first", async () => {
  reset();
  addReview({ markdown: "first", queue: [] });
  addReview({ markdown: "second", queue: [] });
  assert.equal(body(await callTool("get_review")), "second");
  assert.equal(body(await callTool("get_review", { id: 1 })), "first");
  assert.equal((await callTool("get_review", { id: 99 })).isError, true);
  assert.match(body(await callTool("list_reviews")), /^#2\b/m);
});

test("clear_reviews empties the store", async () => {
  reset();
  addReview({ markdown: "x", queue: [] });
  assert.match(body(await callTool("clear_reviews")), /Cleared 1/);
  assert.equal(body(await callTool("list_reviews")), "No reviews stored.");
});

/* --------------------------------------------------------------- screenshots */

// A 1x1 PNG, so the decode path is exercised on bytes that are really a PNG.
const PNG_1x1 =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

test("screenshots are written to disk and the base64 is dropped", async () => {
  reset();
  const review = addReview({
    markdown: "# Review\n\n## 1. <img>\n- Screenshot: 1x1 png",
    queue: [{ descriptor: { shot: { dataUrl: PNG_1x1, width: 1, height: 1, clipped: false } } }],
  });

  const shot = review.queue[0].descriptor.shot;
  assert.equal(shot.dataUrl, null, "the payload must not keep the bytes");
  assert.ok(shot.path, "the note should cite a path instead");

  const bytes = await readFile(shot.path);
  assert.deepEqual([...bytes.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47], "a real PNG header");
  assert.match(review.markdown, /- Screenshot: .*review-\d+-note-1\.png \(1x1 png\)/);
});

test("screenshot paths pair with the right notes when only some have one", () => {
  // The pairing is positional, so the case that would break it is a review
  // where the shots are not the first N notes.
  const md = ["## 1. a", "## 2. b", "- Screenshot: 10x10 png", "## 3. c", "- Screenshot: 20x20 png"].join("\n");
  const linked = linkShots(md, ["/tmp/b.png", "/tmp/c.png"]);
  assert.match(linked, /## 2\. b\n- Screenshot: \/tmp\/b\.png \(10x10 png\)/);
  assert.match(linked, /## 3\. c\n- Screenshot: \/tmp\/c\.png \(20x20 png\)/);
});

test("linkShots leaves a review with no screenshots exactly as it was", () => {
  const md = "## 1. a\n- Box: 10x10";
  assert.equal(linkShots(md, []), md);
});

/* -------------------------------------------------------------- await_review */

test("await_review returns a review that arrived before the call", async () => {
  reset();
  addReview({ markdown: "already here", queue: [] });
  assert.equal(body(await callTool("await_review", { timeout_seconds: 1 })), "already here");
});

test("await_review does not replay a review already handed over", async () => {
  reset();
  addReview({ markdown: "seen", queue: [] });
  await callTool("get_review");
  const r = await callTool("await_review", { timeout_seconds: 1 });
  assert.match(body(r), /No review arrived/, "a served review must not satisfy a later wait");
});

test("await_review wakes when a review arrives while it is parked", async () => {
  reset();
  const waiting = callTool("await_review", { timeout_seconds: 30 });
  setTimeout(() => addReview({ markdown: "sent late", queue: [] }), 30);
  assert.equal(body(await waiting), "sent late");
});

test("a timeout is a plain answer, not an error, and clears the waiter", async () => {
  reset();
  const r = await callTool("await_review", { timeout_seconds: 1 });
  assert.notEqual(r.isError, true, "the model should ask, not treat this as a fault");
  assert.match(body(r), /No review arrived within 1s/);
  // A leaked waiter would resolve this second call instantly with the wrong
  // review; it must park on its own.
  addReview({ markdown: "after the timeout", queue: [] });
  assert.equal(body(await callTool("await_review", { timeout_seconds: 1 })), "after the timeout");
});

test("every advertised tool is actually implemented", async () => {
  reset();
  for (const tool of TOOLS) {
    // await_review would otherwise sit out its 120s default here and make the
    // whole suite unrunnable in CI.
    const r = await callTool(tool.name, { timeout_seconds: 1 });
    assert.ok(r && Array.isArray(r.content), `${tool.name} returned no content`);
    assert.doesNotMatch(body(r), /Unknown tool/, `${tool.name} is advertised but not handled`);
  }
});

test("an unknown tool fails instead of returning something plausible", async () => {
  const r = await callTool("delete_everything", {});
  assert.equal(r.isError, true);
});

/* ------------------------------------------------------------------- wire */

let child;
let port;
const pending = new Map();
let rpcId = 0;

/** One JSON-RPC request over the child's stdin, resolved from its stdout. */
function rpc(method, params) {
  const id = ++rpcId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    setTimeout(() => reject(new Error(`timed out waiting for ${method}`)), 5000);
  });
}

before(async () => {
  // A port well clear of the default, so running the suite never collides with
  // a server the developer has open for real work.
  port = 7000 + (process.pid % 900);
  child = spawn(process.execPath, [SERVER], {
    env: { ...process.env, IC_MCP_LIB: "0", IC_MCP_PORT: String(port), IC_MCP_DIR: join(dir, "wire") },
    stdio: ["pipe", "pipe", "pipe"],
  });

  let buffer = "";
  child.stdout.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    buffer += chunk;
    let nl;
    while ((nl = buffer.indexOf("\n")) !== -1) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (!line) continue;
      const msg = JSON.parse(line); // a non-JSON line on stdout is itself the bug
      const waiter = pending.get(msg.id);
      if (waiter) {
        pending.delete(msg.id);
        if (msg.error) waiter.reject(new Error(msg.error.message));
        else waiter.resolve(msg.result);
      }
    }
  });

  // Wait for the HTTP half to be up before any test posts to it.
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("server never announced itself")), 5000);
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (t) => {
      if (t.includes("listening")) {
        clearTimeout(timer);
        resolve();
      }
    });
  });
});

after(async () => {
  if (child) child.kill();
  await rm(dir, { recursive: true, force: true });
});

test("wire: initialize answers with a protocol version and a server name", async () => {
  const result = await rpc("initialize", {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "test", version: "0" },
  });
  assert.equal(result.protocolVersion, "2025-06-18", "should echo a version it supports");
  assert.equal(result.serverInfo.name, "inspect-comment");
  assert.ok(result.capabilities.tools, "must declare the tools capability or nothing is listed");
});

test("wire: an unknown protocol version falls back rather than failing the handshake", async () => {
  const result = await rpc("initialize", { protocolVersion: "1999-01-01", capabilities: {} });
  assert.equal(result.protocolVersion, "2025-06-18");
});

test("wire: tools/list returns usable schemas", async () => {
  const { tools } = await rpc("tools/list");
  assert.ok(tools.length >= 4);
  for (const tool of tools) {
    assert.ok(tool.name && tool.description, `${tool.name} is under-described`);
    assert.equal(tool.inputSchema.type, "object", `${tool.name} needs an object schema`);
  }
});

test("wire: ping is answered, so the client does not drop the connection", async () => {
  assert.deepEqual(await rpc("ping"), {});
});

test("wire: an unknown method is a JSON-RPC error, not a crash", async () => {
  await assert.rejects(rpc("resources/list"), /Method not found/);
});

test("wire: a notification is never answered", async () => {
  // No id, so a reply would break the client's request/response pairing. If the
  // server did answer, the stdout reader above would parse a message whose id
  // matches nothing, and the following request would still have to work.
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n");
  assert.deepEqual(await rpc("ping"), {});
});

test("wire: a malformed line does not take the server down", async () => {
  child.stdin.write("this is not json\n");
  assert.deepEqual(await rpc("ping"), {});
});

test("wire: the browser posts a review and the agent reads it back", async () => {
  const health = await fetch(`http://127.0.0.1:${port}/health`).then((r) => r.json());
  assert.equal(health.name, "inspect-comment-mcp", "the browser probes for exactly this");

  const posted = await fetch(`http://127.0.0.1:${port}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      page: "http://localhost:3000/pricing",
      markdown: "# Review: /pricing\n\n## 1. <PriceCard>\n**Comment:** the gap is too tight",
      queue: [{ comment: "the gap is too tight" }],
      logs: [],
    }),
  }).then((r) => r.json());
  assert.equal(posted.ok, true);

  const result = await rpc("tools/call", { name: "get_review", arguments: {} });
  assert.match(result.content[0].text, /the gap is too tight/);
});

test("wire: malformed JSON on the bridge is rejected, not stored", async () => {
  const res = await fetch(`http://127.0.0.1:${port}/review`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{ not json",
  });
  assert.equal(res.status, 400);
});

test("wire: the preflight acks Private Network Access", async () => {
  // Without this header Chrome blocks an HTTPS page from reaching loopback, and
  // reports it as an opaque CORS failure that never mentions private networks.
  const res = await fetch(`http://127.0.0.1:${port}/review`, {
    method: "OPTIONS",
    headers: {
      origin: "https://example.com",
      "access-control-request-method": "POST",
      "access-control-request-private-network": "true",
    },
  });
  assert.equal(res.headers.get("access-control-allow-private-network"), "true");
  assert.equal(res.headers.get("access-control-allow-origin"), "https://example.com");
});
