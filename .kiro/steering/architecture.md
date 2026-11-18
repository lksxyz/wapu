# wapu — Architecture Principles

Design as graphs. Every node carries three channels: content, failure, needs.

- Backend / data-flow design (shapes, A/E/R, gen body = A, pipe = E) → [docs/design-thinking.md](../../docs/design-thinking.md)
- Interface / surface design (C/V/N, void states, needs on the edge) → [docs/design-graph.md](../../docs/design-graph.md)
- Multi-agent delegation (subgraph in, implemented graph out) → [docs/graph-protocol.md](../../docs/graph-protocol.md)

**Core invariant: the code IS the graph. If the implementation doesn't match the call graph, the implementation is wrong.**

## Domain language

| Term       | Meaning                                                                                            | Avoid                             |
| ---------- | -------------------------------------------------------------------------------------------------- | --------------------------------- |
| Project    | Durable unit: workspace + one conversation + preview + deploy snapshots                            | App, site, chat                   |
| Session    | Agent conversation bound 1:1 to a project; outlives turns and restarts                             | Thread, chat history              |
| Turn       | One prompt and everything the agent does to answer it                                              | Request, message                  |
| Workspace  | The project's files on disk; every turn mutates the same workspace                                 | Sandbox, container, VM            |
| Preview    | Live rendering on an isolated per-project origin                                                   | Canvas, iframe URL                |
| Snapshot   | Immutable copy captured at deploy time; public host serves a snapshot, never the live workspace    | Release, build, deployment folder |
| Projection | SQLite transcript rebuilt from the session stream; disposable, session is source of truth          | Cache, mirror, copy               |
| Agent      | Configured libfx instance: model + instructions + tools + session store; not an isolation boundary | Sandbox, worker, runtime          |
| Intake     | First project turn: asks questions, picks a design; never writes files                             | Onboarding, setup                 |

## Backend conventions (Effect-TS)

- `Effect.gen` body = happy path (A channel only, no error handling inside)
- `.pipe()` after gen = complete E enumeration
- Each service layer scopes its own E before passing upward — consumers never see implementation errors from deeper layers
- Schema converts `unknown → trusted` at HTTP/file/env boundaries; trust nothing at the edge, trust everything inside
- Resources (DB connections, file handles) are scoped with `Effect.acquireRelease`

## Frontend conventions (SvelteKit 5)

- Component tree = C (happy path content, no state branching inside)
- State variants = V (empty, loading, partial, error, denied — all named, all styled)
- Needs declared on the route edge via `+page.server.ts` loaders; a page never reaches a state its needs aren't satisfied
- Headless primitives from Melt UI, wrapped in `src/lib/components/ui/`

## Call graph output format

```ts
// Production
HTTP handlers
  → ComponentA
    → ComponentA.layerX
      → ComponentB
        → ComponentC

// Tests
HTTP handlers
  → ComponentA
    → componentMemoryLayer
      → ComponentA.layer
        → ComponentB.layerMemory
```

Plain text only, no rendered diagrams. Include call graphs in overviews, architecture summaries, and code explanations.
