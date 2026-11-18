# Agent on libfx with workspace tools, not Firecracker

## Status

accepted

## Context

wapu needs a durable agent conversation per project, live tool activity, and crash-tolerant turns. The previous implementation hand-rolled an OpenAI SSE loop and extracted a single HTML file from the reply, so nothing survived a restart and the UI could not show tool progress.

## Decision

Use `libfx` as the agent loop with one durable `local()` session per project. The agent may only call path-jailed file tools (`list_files`, `read_file`, `write_file`) against `apps/api/projects/<projectId>/`; it has no shell, build, browser, or network tools. A fixed-size workspace with a static multi-file preview replaces the single-HTML contract. The fx session is canonical; SQLite stores project metadata and a rebuildable transcript projection. The browser consumes libfx NDJSON from `turn.readable`, with `session.stream(cursor)` for replay and `session.cancel()` for stop. Previews move to per-project subdomains authenticated by a short-lived signed token, and deploys copy the workspace into an immutable snapshot served on a public subdomain.

No Firecracker microVM runs per chat. With no command execution, server-side code execution is not the threat; the file-tool path jail is the boundary. Firecracker would add kernel/rootfs images, jailer, vsock, networking, and snapshot machinery without removing a present risk.

## Considered options

- **Firecracker per session/turn**: strongest execution boundary, but only necessary once the agent can run generated code or shell commands. Rejected for the files-only scope.
- **Container per project**: useful defense in depth, but still unnecessary without exec; kept as the next step if tools expand.
- **SQLite-canonical conversation**: keeps the old schema but creates two writers and drift. Rejected; fx stream replay reconstructs the projection.
- **Single `index.html` contract**: simplest, but blocks CSS/JS/asset files. Rejected for a persistent workspace.

## Consequences

- The workspace path guard, size limits, and per-project preview origin are security-critical.
- A projection rebuild reads the session stream on project load; long conversations trade latency for a single source of truth.
- Preview assets need a host-only cookie after the token exchange, because relative asset requests cannot carry the iframe token.
- Long-running tools must stay idempotent; `write_file` is a full-file rewrite so replays are safe.
- If the agent later gets shell or build tools, revisit the sandbox decision before enabling them.
