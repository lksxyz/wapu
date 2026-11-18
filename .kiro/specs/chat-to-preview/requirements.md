# Spec: Chat-to-Preview Pipeline

## Overview

The core wapu flow: a user sends a prompt, the agent rewrites `index.html` in the workspace, and the preview iframe refreshes to show the result — all in one turn.

## Requirements

### 1. Project creation

**User story**: As a user, I want to start a new project from the home page so that I land directly in a fresh chat.

Acceptance criteria:

- `POST /api/projects` creates a project row, allocates a workspace directory, and initialises a libfx session
- The API returns `{ id, slug }` immediately; session and workspace are ready before the response
- The platform redirects to `/project/:id` with the first prompt pre-filled from the home page input

### 2. Intake phase

**User story**: As a user, I want the agent to ask me two questions before it builds anything, so the page reflects what I actually want.

Acceptance criteria:

- The first turn calls `ask_user` exactly once with the two intake questions and the design style menu
- `write_file` is not in the tool list during intake; a model that ignores the instruction still cannot write
- The project stage is `intake` until the user answers; it moves to `intake_asked` after the first reply
- The intake questions are rendered as option buttons in the UI, not raw JSON

### 3. Design style selection

**User story**: As a user, I want to pick a visual era for my page from a curated list, so the agent uses a consistent design language.

Acceptance criteria:

- Available styles come from markdown files in `design/`; the agent never invents styles
- When the user picks a style, the matching `design/*.md` is copied into the workspace as `DESIGN.md`
- The project stage moves to `build` after the style is installed
- Every subsequent build prompt includes the content of `DESIGN.md` verbatim

### 4. Build phase — HTML extraction

**User story**: As a user, I want the preview to update as soon as the agent finishes its turn, without me doing anything.

Acceptance criteria:

- The model replies with exactly one fenced ` ```html ` block containing the complete `index.html`
- The API extracts the block from the text stream and writes `index.html` before the response ends
- If the model called `write_file` directly, that write takes precedence over the extraction
- The platform polls `GET /api/projects/:id/stream?cursor=N` and refreshes the preview iframe on `turn_end`

### 5. Live preview

**User story**: As a user, I want the preview to run in an isolated origin so that the generated JS cannot access my session cookies.

Acceptance criteria:

- Draft preview URL is `http://{projectId}.preview.{PREVIEW_DOMAIN}`
- Access requires a short-lived HMAC token in the query param, exchanged for a host-only cookie
- The preview cookie is scoped to the preview subdomain only; the API origin never sets it
- Relative asset requests (`./style.css`, `./app.js`) resolve against the workspace root

### 6. NDJSON stream transport

**User story**: As a user, I want to see the agent's reasoning and tool activity as it happens, not just the final answer.

Acceptance criteria:

- `POST /api/projects/:id/chat` returns `Content-Type: application/x-ndjson`
- Each line is a JSON object with a `type` field: `reasoning_delta`, `tool_start`, `tool_end`, `text_delta`, `turn_end`, `error`
- The platform renders reasoning collapsed while the turn is live
- Tool calls are labelled with the file name (`Reading index.html`, `Writing index.html`)
- `POST /api/projects/:id/stop` calls `session.cancel()` and the stream closes cleanly

### 7. Deploy and export

**User story**: As a user, I want to publish my page to a stable public URL and also be able to download the HTML file.

Acceptance criteria:

- `POST /api/projects/:id/deploy` copies the workspace into `deploys/{id}/{n}/` (incrementing snapshot number)
- The public URL is `http://{slug}.{PUBLIC_DOMAIN}`; it serves the snapshot, never the live workspace
- `GET /api/projects/:id/export` returns `index.html` as a file download
- Deleting a project (`DELETE /api/projects/:id`) removes workspace, session, and all snapshots
