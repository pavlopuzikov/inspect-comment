#!/usr/bin/env node
/**
 * inspect-comment MCP server.
 *
 * Two halves that meet in the middle:
 *
 *   browser  --POST /review-->  this process  --stdio JSON-RPC-->  coding agent
 *
 * The browser half is the inspector's `bridge` option, which posts a finished
 * review to a loopback port. The agent half is MCP, so Claude Code or Cursor
 * can ask for the review rather than the human pasting it in.
 *
 * WHY the protocol is hand-rolled instead of using @modelcontextprotocol/sdk:
 * the whole selling point of this project is that it installs nothing. Adding a
 * dependency tree to ship three tools over newline-delimited JSON-RPC would
 * undercut that for no benefit. The subset of MCP a server this shape needs is
 * initialize, tools/list, tools/call and ping.
 *
 *   node mcp/server.mjs                 # stdio, port 7391
 *   IC_MCP_PORT=9000 node mcp/server.mjs
 */

import http from "node:http";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const PORT = Number(process.env.IC_MCP_PORT || 7391);
const HOST = "127.0.0.1";
const PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26", "2024-11-05"];
// IC_MCP_DIR exists so the test suite does not write into, or clear, the
// store a developer has a real review sitting in.
const DIR = process.env.IC_MCP_DIR || path.join(os.tmpdir(), "inspect-comment-mcp");
const STORE = path.join(DIR, "reviews.json");
const SHOTS = path.join(DIR, "shots");
const MAX_STORED = 20;
const MAX_BODY = 4 * 1024 * 1024;

// stdout is the JSON-RPC channel. Anything else written there corrupts the
// stream and the client disconnects with a parse error that names nothing.
const log = (...a) => process.stderr.write("[inspect-comment] " + a.join(" ") + "\n");

/* ------------------------------------------------------------------ *
 * Review store
 * ------------------------------------------------------------------ */

/** @type {Array<{id:number,receivedAt:string,page:string,viewport:string,count:number,markdown:string,queue:unknown[],logs:unknown[]}>} */
let reviews = [];
let nextId = 1;

// Resolvers for await_review calls that are parked waiting for the next post.
/** @type {Set<(review:unknown)=>void>} */
const waiters = new Set();

// The highest review id any tool call has handed to the agent. await_review
// checks this so that a review sent while the agent was still thinking is
// returned immediately instead of the call parking behind one that already
// arrived, which is the common case: the user sends, then says "got it?".
let lastServed = 0;

function serve(review) {
  if (review && review.id > lastServed) lastServed = review.id;
  return review;
}

function load() {
  try {
    const raw = JSON.parse(fs.readFileSync(STORE, "utf8"));
    if (Array.isArray(raw.reviews)) {
      reviews = raw.reviews;
      nextId = reviews.reduce((m, r) => Math.max(m, r.id), 0) + 1;
    }
  } catch {
    /* first run, or a store from an older shape: start empty */
  }
}

function persist() {
  try {
    fs.mkdirSync(path.dirname(STORE), { recursive: true });
    fs.writeFileSync(STORE, JSON.stringify({ reviews }, null, 2));
  } catch (err) {
    // Losing the store is survivable; the in-memory copy still serves this run.
    log("could not persist:", err.message);
  }
}

/**
 * Move the base64 PNGs out of the payload and onto disk.
 *
 * WHY not leave them inline: a data URL is roughly 1.4 tokens per byte of
 * image, so a single 40 kB screenshot is more context than the entire rest of
 * the review. Written as a file, the agent reads it only if it decides to look
 * at the picture, and reads it as an image rather than as base64 text.
 *
 * Returns the paths in queue order, which is the order the markdown's
 * "- Screenshot:" lines appear in.
 */
function extractShots(id, queue) {
  const paths = [];
  queue.forEach((entry, i) => {
    const shot = entry && entry.descriptor && entry.descriptor.shot;
    if (!shot || typeof shot.dataUrl !== "string") return;
    const comma = shot.dataUrl.indexOf(",");
    if (comma === -1) return;
    const file = path.join(SHOTS, `review-${id}-note-${i + 1}.png`);
    try {
      fs.mkdirSync(SHOTS, { recursive: true });
      fs.writeFileSync(file, Buffer.from(shot.dataUrl.slice(comma + 1), "base64"));
    } catch (err) {
      log("could not write screenshot:", err.message);
      return;
    }
    // Replace the bytes with the path, so the stored review stays small.
    shot.dataUrl = null;
    shot.path = file;
    paths.push(file);
  });
  return paths;
}

/**
 * Put the on-disk paths into the markdown the browser already rendered.
 *
 * The browser cannot know them, so it emits "- Screenshot: 640x120 png" as a
 * placeholder. Pairing is positional and safe: only entries that carry a shot
 * emit that line, and both lists are built from the same queue in order.
 */
function linkShots(markdown, paths) {
  if (!paths.length) return markdown;
  let n = 0;
  return markdown.replace(/^- Screenshot: (.*)$/gm, (line, rest) =>
    n < paths.length ? `- Screenshot: ${paths[n++]} (${rest})` : line
  );
}

function removeShots(review) {
  for (const entry of review.queue || []) {
    const shot = entry && entry.descriptor && entry.descriptor.shot;
    if (shot && shot.path) {
      try {
        fs.rmSync(shot.path, { force: true });
      } catch {
        /* already gone, or the temp dir was cleared under us */
      }
    }
  }
}

function addReview(payload) {
  const id = nextId++;
  const queue = Array.isArray(payload.queue) ? payload.queue : [];
  const shots = extractShots(id, queue);
  const review = {
    id,
    receivedAt: new Date().toISOString(),
    page: typeof payload.page === "string" ? payload.page : "",
    viewport: typeof payload.viewport === "string" ? payload.viewport : "",
    count: queue.length,
    shots: shots.length,
    markdown: linkShots(typeof payload.markdown === "string" ? payload.markdown : "", shots),
    queue,
    logs: Array.isArray(payload.logs) ? payload.logs : [],
  };
  reviews.unshift(review);
  while (reviews.length > MAX_STORED) removeShots(reviews.pop());
  persist();

  for (const resolve of waiters) resolve(review);
  waiters.clear();
  return review;
}

/* ------------------------------------------------------------------ *
 * HTTP bridge (browser -> here)
 * ------------------------------------------------------------------ */

function cors(res, req) {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Vary", "Origin");
  // Chrome's Private Network Access check: a public HTTPS page reaching a
  // loopback address sends this preflight, and without the ack the POST is
  // blocked with a CORS error that does not mention private networks at all.
  if (req.headers["access-control-request-private-network"]) {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
}

const json = (res, code, body) => {
  res.writeHead(code, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
};

const server = http.createServer((req, res) => {
  cors(res, req);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${HOST}:${PORT}`);

  // The inspector probes this before offering to send, so that a failed post
  // never shows up in the reviewer's own captured network log.
  if (req.method === "GET" && url.pathname === "/health") {
    json(res, 200, { ok: true, name: "inspect-comment-mcp", reviews: reviews.length });
    return;
  }

  if (req.method === "POST" && url.pathname === "/review") {
    let body = "";
    let aborted = false;
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > MAX_BODY) {
        aborted = true;
        json(res, 413, { error: "review too large" });
        req.destroy();
      }
    });
    req.on("end", () => {
      if (aborted) return;
      try {
        const review = addReview(JSON.parse(body));
        log(
          `received review #${review.id}: ${review.count} note(s), ` +
            `${review.shots} screenshot(s) on ${review.page}`
        );
        json(res, 200, { ok: true, id: review.id, count: review.count });
      } catch (err) {
        json(res, 400, { error: "invalid JSON: " + err.message });
      }
    });
    return;
  }

  json(res, 404, { error: "not found" });
});

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    // Almost always a second editor window starting its own copy. The stdio
    // half still works; it just shares the store with whoever owns the port.
    log(`port ${PORT} already in use, continuing without the HTTP bridge`);
  } else {
    log("http error:", err.message);
  }
});

/* ------------------------------------------------------------------ *
 * Tools
 * ------------------------------------------------------------------ */

const text = (s) => ({ content: [{ type: "text", text: s }] });
const fail = (s) => ({ content: [{ type: "text", text: s }], isError: true });

function describeReview(r) {
  const shots = r.shots ? `  ${r.shots} shot${r.shots === 1 ? "" : "s"}` : "";
  return `#${r.id}  ${r.count} note${r.count === 1 ? "" : "s"}${shots}  ${r.page || "(unknown page)"}  ${r.receivedAt}`;
}

const TOOLS = [
  {
    name: "get_review",
    description:
      "Get the most recent design review captured with inspect-comment in the browser. " +
      "Each note names a specific element (component path, source file and line, CSS " +
      "selector, computed box, WCAG contrast, position in the page's focus order) plus " +
      "the reviewer's comment and any exact CSS values they dialled in. A note may cite " +
      "a screenshot by absolute path; read that file to see the element as rendered. Use " +
      "this when the user refers to feedback, notes, or a review they made in the browser.",
    inputSchema: {
      type: "object",
      properties: {
        format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "markdown is the prose review; json is the structured queue. Default markdown.",
        },
        id: {
          type: "number",
          description: "A specific review id from list_reviews. Defaults to the latest.",
        },
      },
    },
  },
  {
    name: "await_review",
    description:
      "Wait for the user to send a new review from the browser, and return it when it " +
      "arrives. Use this after asking the user to go and mark up the page, so you receive " +
      "their notes without them pasting anything. Returns a timeout message if nothing " +
      "arrives in time; that is not an error, just ask whether they still intend to send one.",
    inputSchema: {
      type: "object",
      properties: {
        timeout_seconds: {
          type: "number",
          description: "How long to wait. Default 120, maximum 600.",
        },
      },
    },
  },
  {
    name: "list_reviews",
    description:
      "List the reviews received this session, newest first, with their id, page and note count.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "clear_reviews",
    description: "Discard every stored review. Use once the feedback has been acted on.",
    inputSchema: { type: "object", properties: {} },
  },
];

async function callTool(name, args = {}) {
  if (name === "get_review") {
    if (!reviews.length) {
      return fail(
        "No review has been received yet.\n\n" +
          "The user captures one in the browser with inspect-comment, then presses " +
          '"Copy all" in the queue panel, which also sends it here. If they have not done ' +
          "that yet, call await_review to wait for it."
      );
    }
    const r = args.id ? reviews.find((x) => x.id === args.id) : reviews[0];
    if (!r) return fail(`No review with id ${args.id}. Call list_reviews to see what is stored.`);
    serve(r);
    if (args.format === "json") return text(JSON.stringify({ ...r, markdown: undefined }, null, 2));
    return text(r.markdown || "(the review arrived with no markdown body)");
  }

  if (name === "await_review") {
    const seconds = Math.min(Math.max(Number(args.timeout_seconds) || 120, 1), 600);

    // Already here and not yet handed over: return it rather than waiting for a
    // second one the user has no reason to send.
    if (reviews.length && reviews[0].id > lastServed) {
      return text(serve(reviews[0]).markdown);
    }

    const received = await new Promise((resolve) => {
      const settle = (review) => {
        clearTimeout(timer);
        waiters.delete(settle);
        resolve(review);
      };
      const timer = setTimeout(() => settle(null), seconds * 1000);
      waiters.add(settle);
    });

    if (!received) {
      return text(
        `No review arrived within ${seconds}s. The user may still be marking up the page. ` +
          "Ask whether they want more time, then call await_review again."
      );
    }
    return text(serve(received).markdown || "(the review arrived with no markdown body)");
  }

  if (name === "list_reviews") {
    if (!reviews.length) return text("No reviews stored.");
    return text(reviews.map(describeReview).join("\n"));
  }

  if (name === "clear_reviews") {
    const n = reviews.length;
    for (const r of reviews) removeShots(r);
    reviews = [];
    lastServed = 0;
    persist();
    return text(`Cleared ${n} review${n === 1 ? "" : "s"}.`);
  }

  return fail(`Unknown tool: ${name}`);
}

/* ------------------------------------------------------------------ *
 * JSON-RPC over stdio
 * ------------------------------------------------------------------ */

function send(msg) {
  process.stdout.write(JSON.stringify(msg) + "\n");
}

const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
const replyError = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

async function handle(msg) {
  const { id, method, params } = msg;
  // A notification has no id and must never be answered.
  const isRequest = id !== undefined && id !== null;

  switch (method) {
    case "initialize": {
      const asked = params && params.protocolVersion;
      const version = PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0];
      reply(id, {
        protocolVersion: version,
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: "inspect-comment", version: "2.0.0" },
        instructions:
          "Design review notes captured from a live page with inspect-comment. get_review " +
          "returns the latest; await_review blocks until the user sends one from the " +
          "browser. Notes cite screenshots by absolute path: read those files directly.",
      });
      return;
    }
    case "notifications/initialized":
    case "notifications/cancelled":
      return; // nothing to acknowledge
    case "ping":
      if (isRequest) reply(id, {});
      return;
    case "tools/list":
      reply(id, { tools: TOOLS });
      return;
    case "tools/call": {
      const name = params && params.name;
      try {
        reply(id, await callTool(name, (params && params.arguments) || {}));
      } catch (err) {
        // A thrown tool is reported as a failed result, not a protocol error:
        // the model can read and act on the former.
        reply(id, fail(`${name} failed: ${err.message}`));
      }
      return;
    }
    default:
      if (isRequest) replyError(id, -32601, `Method not found: ${method}`);
  }
}

// Exported so test/mcp.test.mjs can drive the tool layer directly, without a
// child process and without binding a port. Nothing else imports this file.
export const __test = { callTool, addReview, linkShots, TOOLS, reset };

function reset() {
  reviews = [];
  nextId = 1;
  lastServed = 0;
  waiters.clear();
}

// Importing this module for a test must not also start a server on a port the
// developer may already be using, nor hold the process open on stdin.
if (process.env.IC_MCP_LIB !== "1") {
  start();
}

function start() {
  let buffer = "";
  process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buffer += chunk;
  let nl;
  while ((nl = buffer.indexOf("\n")) !== -1) {
    const line = buffer.slice(0, nl).trim();
    buffer = buffer.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      replyError(null, -32700, "Parse error");
      continue;
    }
    handle(msg).catch((err) => log("handler crashed:", err.stack || err.message));
  }
});

  process.stdin.on("end", () => process.exit(0));

  load();
  server.listen(PORT, HOST, () => {
    log(`bridge listening on http://${HOST}:${PORT}, ${reviews.length} stored review(s)`);
  });
}
