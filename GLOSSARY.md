# wapu

Vibecoding workspace: one artifact per project, edited through a durable agent conversation.

## Language

**Project**:
The durable unit a person owns: its workspace, one conversation, its preview, and its deploy snapshots.
_Avoid_: App, site, chat

**Session**:
The agent conversation bound 1:1 to a project. It outlives turns and server restarts.
_Avoid_: Thread, chat history

**Turn**:
One prompt and everything the agent does to answer it.
_Avoid_: Request, message

**Workspace**:
The project's files on disk. Every turn mutates the same workspace.
_Avoid_: Sandbox, container, VM

**Preview**:
The live rendering of a workspace on an isolated per-project origin.
_Avoid_: Canvas, iframe URL

**Snapshot**:
An immutable copy of a workspace captured at deploy time. A public host serves a snapshot, never the live workspace.
_Avoid_: Release, build, deployment folder

**Projection**:
The SQLite transcript rebuilt from a session's stored stream. Disposable; the session is the source of truth.
_Avoid_: Cache, mirror, copy

**Agent**:
The configured libfx instance: model, instructions, tools, and session store. It is not an isolation boundary.
_Avoid_: Sandbox, worker, runtime

**Intake**:
The project's first turn. It asks a few questions and picks a design; it never writes files.
_Avoid_: Onboarding, wizard, setup

**Design**:
One markdown file in `design/`. The only style menu the agent may offer, copied into the workspace as `DESIGN.md` once chosen.
_Avoid_: Theme, skin, style guide
