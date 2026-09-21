---
description: Verify whether a local dev server (npm start / FableCut / Mint CLI) is actually running, and identify which project owns a given port in this workspace.
revisions: 1
---

# Check Running Servers

Use when the user asks "is my server running?", "is `npm start` up?", "what's on port N?", or before editing video you need to confirm the FableCut/FableMint editor is live. Don't guess from memory — gather live evidence.

## 1. Find the process and confirm its signature

```bash
ps -ef | grep -E 'npm|node|vite|server\.js' | grep -v grep
```

The process tree **is** the fingerprint:
- `npm start` → `npm (PID)` → `sh -c node server.js` → `node server.js`. That `sh -c` wrapper is the `npm start` signature.
- An MCP-spawned editor instead appears as a bare `node server.js` with no `npm`/`sh -c` parent.
- Note the start time so you can report uptime.

## 2. List listening ports

```bash
ss -ltnp   # or: lsof -iTCP -sTCP:LISTEN -P -n
```

Map each listener to a project (see port map below) before answering.

## 3. Prove the app responds (HTTP probe)

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:7777/
```

A 200 is necessary but not sufficient — confirm *which* app it is (step 4).

## 4. Confirm identity by byte-matching

Compare the served `Content-Length` to the project file on disk:

```bash
curl -sI http://127.0.0.1:7777/ | grep -i content-length
wc -c index.html
```

If the sizes match exactly, the port really is serving that project. Also check the script in `package.json` (`"start": "node server.js"`) and the port default in the server source (`PORT || 7777`).

## 5. Workspace port map (don't confuse these)

| Port | What it is | Notes |
|---|---|---|
| `7777` | FableCut / FableMint editor | The real editor UI. `/` → 200. |
| `3000` | Mint CLI `rust-api-server` | API only — `/` returning 404 is normal; probe `/api/status` instead (reports `backend: rust-api-server`). |
| vite preview | Mint-CLI `npm run preview:web` | Separate project, often already running. |

Gotcha: `mcp-server.js` (fablemint) is a **stdio** server, not a lingering daemon. It spawns `node server.js` on demand only if the editor isn't already up. If the editor was started with `npm start`, the MCP server will reuse it — so check the process tree before blaming MCP for a stray server. `npm run dev` does not exist in this project; only `start`.

## 6. Report and offer next actions

Tell the user: process + PID, start time/uptime, port, HTTP status, and byte-match confirmation. Then offer: open a project and drop the first clip, inspect logs, or stop a stray server.

## 7. Stopping a server

```bash
# Ctrl+C in the owning terminal, or kill the npm PID (children follow):
kill 231878
```

Quick re-check anytime: `curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:7777/`
