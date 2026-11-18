# wapu

Vibecoding platform. Describe a web page, get working HTML/CSS/JS, deploy or export.

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

The agent is `libfx` with a durable `local()` session store and path-jailed file
tools. It has no shell, no browser, and no network tools, so no Firecracker or
container runs per chat; see
[ADR 0001](docs/adr/0001-libfx-agent-workspace-preview.md).

## Interface

The shell follows the ChatGPT flow: the root layout loads the signed-in user and
project list once, the sidebar groups conversations by date, `/` starts a new
chat, and `/project/:id` is a transcript with a collapsible live preview canvas.
The divider between transcript and canvas is draggable (arrow keys when focused,
double-click resets), and the width persists in `localStorage`.

Every chat turn carries a real process trace. libfx streams `reasoning_delta`,
`tool_start`, `tool_end`, and `text_delta` events; the client renders reasoning
collapsed while live, labels each tool call (`Reading index.html`,
`Writing index.html`), and persists summarized steps in the SQLite projection.
The transcript itself is rebuilt from `session.stream(0)`; the fx session stays
the source of truth.

A new project starts in intake. Its first turn asks two questions instead of
writing files, and the project page renders the styles in `design/` as buttons —
the only style menu the agent may present. The chosen markdown is copied into
the workspace as `DESIGN.md`, the project moves to build, and every later turn
carries that specification. `write_file` refuses to run while a project is in
intake, so a model that ignores the instruction still cannot build early.

Build turns ask for the page as one fenced `html` block. The API extracts it and
writes `index.html` before the response ends, so the preview refresh sees the new
file. Small local models narrate instead of calling tools; the text contract is
what they can actually follow. A successful `write_file` tool call still works
and takes precedence.

The custom provider pins `temperature: 0.2` and `top_p: 0.9`, and the page budget
is 3000 characters. Without stable sampling, qwen3-1.7b drifts into token loops
long before the closing fence.

Headless primitives (tooltip, menu, confirm dialog) come from
[Melt UI](https://github.com/melt-ui/melt-ui) and are wrapped in
`apps/platform/src/lib/components/ui/`.

## Setup

### 1. Google OAuth credentials

Go to [console.cloud.google.com](https://console.cloud.google.com), create an OAuth 2.0 client:

- Authorized JS origins: `http://localhost:3000`
- Authorized redirect URIs: `http://localhost:3000/auth/callback/google`

### 2. Configure API env

```sh
cp apps/api/.env.example apps/api/.env
```

Fill in:

```sh
BETTER_AUTH_SECRET=<run: openssl rand -base64 32>
GOOGLE_CLIENT_ID=<your-client-id>.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=<your-client-secret>
OPENAI_API_KEY=<your-key>
OPENAI_BASE_URL=https://api.openai.com/v1   # or any OpenAI-compatible endpoint
OPENAI_MODEL=gpt-4o                          # or any model you have access to
TURN_TIMEOUT_MS=900000

PREVIEW_DOMAIN=preview.localhost
PUBLIC_DOMAIN=localhost
PUBLIC_SCHEME=http
PREVIEW_TOKEN_SECRET=<run: openssl rand -base64 32>
```

Agent sessions live in `apps/api/.fx/sessions` unless `FX_SESSIONS_DIR` is set.
Keep that directory on persistent disk and include it in backups.

If the model server is qvac, the alias must be loaded with tool calling,
otherwise every turn fails with `tools_not_enabled`:

```json
{
  "serve": {
    "models": {
      "qwen3-1.7b": {
        "model": "QWEN3_1_7B_INST_Q4",
        "preload": true,
        "config": { "ctx_size": 8192, "tools": true }
      }
    }
  }
}
```

Restart `qvac serve --openai` after changing `qvac.config.json`; the config is
read at startup. Small models call tools less reliably than larger ones.

The libfx schema is v2. On the first boot after upgrading from the single-HTML
version, it wipes old projects, messages, workspaces, and deploys. This is
intentional: the previous transcript cannot be imported into an fx session.

### 3. Install and run

```sh
pnpm install

# Terminal 1
pnpm dev:api

# Terminal 2
pnpm dev:platform
```

Platform runs at `http://localhost:5173`, API at `http://localhost:3000`.

## Local preview

Draft previews use an isolated per-project origin:

- **Draft**: `http://{projectId}.preview.localhost:3000` — signed token, then a
  host-only preview cookie
- **Deployed**: `http://{slug}.localhost:3000` — immutable snapshot

`*.localhost` and `*.preview.localhost` resolve to 127.0.0.1 on Linux/macOS
without `/etc/hosts` changes. In production, point `PREVIEW_DOMAIN` and
`PUBLIC_DOMAIN` at wildcard DNS names; the app never serves previews or public
apps from the API origin.

## Project structure

```
design/     style specifications offered during intake, one markdown per era
apps/
  api/        Effect-ts HTTP server
    src/
      index.ts        startup — migrations, legacy wipe, server
      server.ts       HTTP server, CORS, preview/public host routing, auth
      auth.ts         better-auth configuration (Google OAuth, SQLite)
      db.ts           SQLite init — projects, projection, v2 wipe, v3 stages
      ai/
        agent.ts      libfx agent, durable sessions, session cleanup
        design.ts     design/ menu, style matching, DESIGN.md install
        tools.ts      path-jailed list/read/write tools + limits
        projection.ts  session stream → SQLite transcript
        prompt.ts     system, intake, style, and build instructions
      preview/
        host.ts       tokenized draft host, snapshot public host
        serve.ts      static workspace files, path guard, MIME
      projects/
        schema.ts     Project, Message, MessageStep
        storage.ts    SQLite CRUD, snapshots, deploy toggle
        workspace.ts  workspace/snapshot paths, copy, prune, wipe
        preview-token.ts  HMAC preview tokens and origin URLs
      routes/
        api.ts        /api/** handlers, NDJSON chat, stop, preview URL
  platform/   SvelteKit 5 frontend
    src/
      hooks.server.ts  session guard — redirect /login if no session
      lib/
        api.ts         typed fetch wrapper + preview/deploy URLs
        auth-client.ts better-auth browser client
        format.ts      assistant prose → safe markup, prompt → title
        time.ts        project history buckets
        shell.svelte.ts  sidebar context for pages
        components/
          app/Sidebar.svelte        history, search, delete, account
          chat/Composer.svelte      auto-growing prompt input
          chat/Message.svelte       user bubble + assistant prose
          chat/Process.svelte       reasoning and tool-step trace
          chat/PromptSuggestions.svelte
          ui/ConfirmDialog.svelte   melt dialog wrapper
          ui/Menu.svelte            melt popover menu wrapper
          ui/Tooltip.svelte         melt tooltip wrapper
          ui/Icon.svelte            inline icon set
      routes/
        +layout.server.ts  user + project list for the sidebar
        +layout.svelte     app shell, mobile drawer, theme
        +page.svelte       new chat (create + hand off first prompt)
        login/
          +page.svelte  Google sign-in
        project/[id]/
          +page.svelte     transcript + preview canvas, NDJSON transport
          +page.server.ts  project + projection loader
```

Vocabulary and the architecture decision live in [GLOSSARY.md](GLOSSARY.md) and
[ADR 0001](docs/adr/0001-libfx-agent-workspace-preview.md).
