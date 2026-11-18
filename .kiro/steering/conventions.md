# wapu — Code Conventions

## File and module layout

```
apps/
  api/
    src/
      index.ts          startup: migrations, legacy wipe, server bind
      server.ts         HTTP server, CORS, host routing, auth middleware
      auth.ts           better-auth config (Google OAuth, SQLite adapter)
      db.ts             SQLite init, schema migrations, v2/v3 wipe guards
      ai/
        agent.ts        libfx agent factory, session lifecycle, cleanup
        design.ts       design/ menu, style matching, DESIGN.md install
        tools.ts        path-jailed list/read/write + size limits
        projection.ts   session stream → SQLite transcript rows
        prompt.ts       system, intake, style, and build prompt builders
      preview/
        host.ts         tokenized draft host, snapshot public host
        serve.ts        static workspace files, path guard, MIME types
      projects/
        schema.ts       Project, Message, MessageStep branded types
        storage.ts      SQLite CRUD, snapshot writes, deploy toggle
        workspace.ts    workspace/snapshot paths, copy, prune, wipe
        preview-token.ts  HMAC token sign/verify, origin URL builders
      routes/
        api.ts          /api/** handlers, NDJSON chat stream, stop, URLs
  platform/
    src/
      hooks.server.ts   session guard: redirect /login if no session
      lib/
        api.ts          typed fetch wrapper, preview/deploy URL helpers
        auth-client.ts  better-auth browser client
        format.ts       assistant prose → safe markup, prompt → title
        time.ts         project history date buckets
        shell.svelte.ts sidebar context shared across pages
        components/
          app/           app-level components (Sidebar)
          chat/          chat turn components (Message, Process, Composer)
          ui/            headless primitive wrappers (Melt UI)
      routes/
        +layout.server.ts   user + project list for sidebar
        +layout.svelte      app shell, mobile drawer, theme toggle
        +page.svelte        new chat: create project + hand off prompt
        login/+page.svelte  Google sign-in button
        project/[id]/
          +page.svelte      transcript + preview canvas, NDJSON reader
          +page.server.ts   project + projection loader
```

## Naming

- Files: `kebab-case.ts`, except SvelteKit route files (`+page.svelte`, `+layout.server.ts`)
- Types/interfaces: `PascalCase`
- Functions and variables: `camelCase`
- Database columns: `snake_case`
- One export per file for route handlers; named exports for utility modules

## Effect-TS patterns

```ts
// Service definition
export class ProjectStorage extends Effect.Service<ProjectStorage>()("ProjectStorage", {
  effect: Effect.gen(function* () { ... }),
}) {}

// Handler pattern: gen = A, pipe = E
const handler = Effect.gen(function* () {
  const db = yield* ProjectStorage
  const project = yield* db.findById(id)
  return project
}).pipe(
  Effect.catchTag("ProjectNotFound", () => HttpServerResponse.empty({ status: 404 })),
)
```

## SvelteKit 5 patterns

- Use runes (`$state`, `$derived`, `$effect`) — no legacy stores
- Server loaders return typed data; pages receive it via `data` prop
- NDJSON chat stream: `fetch` → `ReadableStream` → line-by-line `JSON.parse`
- Void states (empty, loading, error) are explicit branches in markup, not CSS hacks

## Agent prompt contracts

- **Intake phase**: model calls `ask_user` once with 2–3 questions; no file tools allowed
- **Build phase**: model replies with exactly one fenced ` ```html ` block; API extracts it
- Both contracts are enforced at the API level — a model that ignores the instruction still cannot build during intake (`write_file` is removed from the tool list) and the HTML extraction runs regardless of whether the model called `write_file`

## Preview security

- Draft previews: `{projectId}.preview.{PREVIEW_DOMAIN}` — HMAC token in query param → host-only cookie
- Public snapshots: `{slug}.{PUBLIC_DOMAIN}` — immutable, no auth
- Never serve preview or public content from the API origin
- Path guard in `serve.ts` rejects any path that escapes the workspace root (`..\`, symlinks)
