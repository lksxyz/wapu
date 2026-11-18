# Design: Chat-to-Preview Pipeline

## Surfaces

```
Login           → sign-in page, Google OAuth button
Home            → new chat composer, no project context
Sidebar         → project history grouped by date, search, delete, account
ProjectChat     → transcript + live preview canvas
  Composer      → auto-growing prompt input, send/stop button
  Message       → user bubble | assistant prose
  Process       → reasoning (collapsed while live) + tool-call trace
  PreviewCanvas → resizable iframe, preview/deploy/export controls
```

## Flow graph (C)

```
Login
  → Home (new chat)
    → ProjectChat (intake phase)
      → ProjectChat (intake_asked — style picker rendered)
        → ProjectChat (build phase — preview live)
          → Deploy (immutable snapshot published)
          → Export (index.html download)
```

## Void states (V) per surface

| Surface                | empty             | loading               | partial                            | error                 | denied                        |
| ---------------------- | ----------------- | --------------------- | ---------------------------------- | --------------------- | ----------------------------- |
| Sidebar project list   | "No projects yet" | skeleton rows         | —                                  | toast                 | redirect /login               |
| ProjectChat transcript | —                 | spinner on first load | prior turns shown while streaming  | inline error message  | redirect /login               |
| PreviewCanvas          | blank iframe      | —                     | prior snapshot while new turn runs | "Preview unavailable" | —                             |
| Composer               | placeholder text  | send button → spinner | —                                  | —                     | disabled while turn in flight |

## Needs (N) per surface

| Surface       | Needs                                                    |
| ------------- | -------------------------------------------------------- |
| Home          | authenticated user                                       |
| ProjectChat   | authenticated user + valid project id                    |
| PreviewCanvas | project in `build` stage + at least one successful write |
| Deploy button | project in `build` stage                                 |
| Export button | `index.html` present in workspace                        |

## State machine: project stage

```
created → intake → intake_asked → build
```

- `created`: project row exists, session initialised, workspace allocated
- `intake`: first turn in flight or awaiting first user reply
- `intake_asked`: user answered intake; style not yet chosen
- `build`: DESIGN.md installed; all subsequent turns produce HTML

Transitions are one-way. No turn can move a project backwards.

## NDJSON event shape

```ts
type StreamEvent =
  | { type: "reasoning_delta"; delta: string }
  | { type: "tool_start"; name: string; input: unknown }
  | { type: "tool_end"; name: string; output: unknown }
  | { type: "text_delta"; delta: string }
  | { type: "turn_end" }
  | { type: "error"; message: string };
```

The platform reads events line-by-line. `turn_end` triggers preview iframe reload.

## Resizable canvas

- Divider between transcript and canvas is draggable (pointer events)
- Arrow keys move divider when it has focus (10 px per keypress)
- Double-click resets to 50/50
- Width persists in `localStorage` under key `wapu:canvas-width`
- Below 640 px viewport: canvas collapses to a drawer, transcript is full width
