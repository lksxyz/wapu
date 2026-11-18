# wapu — Project Overview

Vibecoding platform. Describe a web page, get working HTML/CSS/JS, deploy or export.

## What it does

A user signs in with Google, starts a new chat, and describes a web page. The agent asks two intake questions and offers a design style. After the user picks a style, every subsequent turn rewrites `index.html` in a path-jailed workspace. A live preview renders in an isolated per-project subdomain (`{projectId}.preview.localhost`). Finished projects deploy to an immutable public snapshot (`{slug}.localhost`).

## Stack

- **API**: Effect-TS HTTP server, `libfx` agent loop, SQLite (better-sqlite3), better-auth (Google OAuth)
- **Platform**: SvelteKit 5, Melt UI headless primitives
- **Agent**: libfx durable local sessions, path-jailed file tools (`list_files`, `read_file`, `write_file`)
- **Preview**: per-project subdomain, HMAC-signed short-lived token → host-only cookie

## Call graph

````ts
// Production
browser
  → /login → Google OAuth (better-auth) → /
  → / (new chat)
    → POST /api/projects → agent.newSessionId + workspace
    → /project/:id → pending prompt auto-sends
  → /project/:id (chat + canvas)
    → root layout GET /api/projects → sidebar history
    → GET /api/projects/:id
      → rebuildProjection ← session.stream(0)
    → POST /api/projects/:id/chat
      → phase intake → two questions, no tools
      → phase intake_asked → style answer → design/<slug>.md → workspace/DESIGN.md
      → phase build → session.prompt (html block contract)
        → text deltas → API extracts ```html → projects/<projectId>/index.html
        → fallback: write_file tool_end, if the model called it
    → GET /api/projects/:id/stream?cursor=N → session.stream(N)
    → POST /api/projects/:id/stop → session.cancel()
    → preview iframe
      → {projectId}.preview.localhost?token=…
        → host-only cookie → workspace files
    → POST /api/projects/:id/deploy
      → copy workspace → deploys/<id>/<n>
      → {slug}.PUBLIC_DOMAIN serves the snapshot
    → GET /api/projects/:id/export → download index.html
    → DELETE /api/projects/:id → cascade workspace, session, snapshots
````

## Key constraints

- Agent has no shell, browser, or network tools — file jail is the only security boundary
- `write_file` is a full-file rewrite; replays are safe
- Preview assets use a host-only cookie after the token exchange (relative requests can't carry the iframe token)
- Workspace limits: 64 files, 1 MiB per file, 16 MiB total
- Build turns: model must reply with one fenced ` ```html ` block; API extracts it before the response ends
- Intake turns: `write_file` is disabled; the model uses `ask_user` only
