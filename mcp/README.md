# MCP server

Lets a coding agent ask for your design review instead of you pasting it.

You mark up the page in the browser as usual. When you press **Copy all**, the
review also goes to a loopback port on your machine. Claude Code, Cursor or
anything else that speaks MCP then reads it with a tool call.

```
browser  ──POST http://127.0.0.1:7391/review──▶  server.mjs  ──stdio JSON-RPC──▶  your agent
```

Nothing leaves your machine. There is no account, no hosted service, and the
port only ever binds to `127.0.0.1`.

## Install

Nothing to install. It is one file with no dependencies, run by the Node you
already have.

**Claude Code**

```bash
claude mcp add inspect-comment -- npx -y inspect-comment-mcp
```

**Cursor**, or anything else reading `mcp.json`:

```json
{
  "mcpServers": {
    "inspect-comment": {
      "command": "npx",
      "args": ["-y", "inspect-comment-mcp"]
    }
  }
}
```

From a clone, point at the file instead:

```json
{
  "mcpServers": {
    "inspect-comment": {
      "command": "node",
      "args": ["/absolute/path/to/inspect-comment/mcp/server.mjs"]
    }
  }
}
```

## Tools

| Tool | What it does |
| --- | --- |
| `get_review` | The most recent review, as markdown or as structured JSON. |
| `await_review` | Blocks until you send one from the browser. Say "go and mark up the page, I'll wait" and the agent actually does. |
| `list_reviews` | Everything received this session, newest first. |
| `clear_reviews` | Throw them away once they are acted on. |

`await_review` is the one worth knowing about. The agent asks you to look at
something, parks, and picks up your notes the moment you send them, with no
copy-paste and no "here's my feedback:" message.

## Screenshots

A note can carry a PNG of the element as the browser painted it. Press **Shot**
in the comment panel; the first one asks for screen-capture permission, and the
rest of the session does not.

The server writes each image to disk and puts the path in the note:

```
- Screenshot: /tmp/inspect-comment-mcp/shots/review-3-note-1.png (412x88 png)
```

The agent reads that file if it decides it needs to look. The bytes deliberately
do not travel inline: a 40 kB screenshot as a base64 data URL is more context
than the entire rest of the review, spent before anyone has decided the picture
matters.

## Configuration

| Variable | Default | |
| --- | --- | --- |
| `IC_MCP_PORT` | `7391` | Change it in both halves: `mount({ bridge: "http://127.0.0.1:9000" })`. |
| `IC_MCP_DIR` | `<tmp>/inspect-comment-mcp` | Where reviews and screenshots are kept. |

The browser side is on by default and needs no configuration. It probes
`/health` once at mount and again on the first copy, so starting the server
after opening the page works without a reload. To turn it off:

```js
mount({ bridge: false });
```

## If it does not connect

**The toast says "Copied", not "Copied · sent to agent".** Nothing was
listening. Check the server is running: your MCP client starts it, so the
quickest test is to open the client. `curl http://127.0.0.1:7391/health` should
answer `{"ok":true,...}`.

**The page is HTTPS.** Browsers treat `127.0.0.1` as a secure origin, so this
works, but Chrome sends a Private Network Access preflight first. The server
answers it. A corporate policy that blocks private network requests outright
will still stop it, and the failure presents as an ordinary CORS error that
never mentions private networks.

**The page has a strict `connect-src` CSP.** The review is blocked before it
leaves the page. There is no way around this from inside the page; use the
clipboard, which still works.

**Port already in use.** The server logs it to stderr and carries on without the
HTTP half, so the agent side still answers with whatever is stored. Change
`IC_MCP_PORT` if you want both.

## Notes on the implementation

The JSON-RPC is hand-rolled rather than built on `@modelcontextprotocol/sdk`.
The whole claim of this project is that it installs nothing, and the subset of
MCP a server this shape needs is `initialize`, `tools/list`, `tools/call` and
`ping`. That is a few dozen lines against a dependency tree.

The tradeoff is that a hand-rolled protocol has to be exercised rather than
assumed, so `test/mcp.test.mjs` spawns the real server and speaks to it over a
pipe: the handshake, an unknown protocol version, a notification that must not
be answered, a malformed line that must not be fatal, and a full
browser-posts-then-agent-reads round trip. Those failures all present to a user
as "the MCP server shows no tools", with nothing anywhere to explain why.
