import fs from "node:fs/promises";
import { Effect } from "effect";
import { runMigrations } from "./db.js";
import { PROJECTS_DIR, resetLegacyWorkspaces } from "./projects/workspace.js";
import { listAllProjects } from "./projects/storage.js";
import { agent } from "./ai/agent.js";
import { auth } from "./auth.js";
import { createServer } from "./server.js";

// ── A: startup call graph ─────────────────────────────────────────────────
//
// runMigrations (wapu domain: projects, messages, v2 wipe)
//   → resetLegacyWorkspaces (single-HTML era files)
//   → auth.$context (better-auth runs its own migrations at init)
//   → createServer (binds port — R: both db layers must be ready)
// E: any failure here → Die. The server must not listen until all tables exist.
// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const { reset } = runMigrations();
  if (reset) {
    await resetLegacyWorkspaces();
    console.log("[wapu] v2 schema: legacy projects, files, and deploys wiped");
  } else {
    await fs.mkdir(PROJECTS_DIR, { recursive: true });
  }

  await auth.$context;

  if (!process.env.PREVIEW_TOKEN_SECRET) {
    console.warn("[wapu] PREVIEW_TOKEN_SECRET is unset; using the insecure development secret");
  }

  // A process that stopped mid-turn leaves the fx turn open. Resume it now;
  // the projection picks up the result on the next project load.
  const projects = await Effect.runPromise(
    listAllProjects().pipe(Effect.catch(() => Effect.succeed([]))),
  );
  for (const project of projects) {
    try {
      void agent
        .session(project.sessionId)
        .resume()
        .result.catch((e) => console.error("[wapu] resume failed:", project.id, e));
    } catch (e) {
      console.error("[wapu] resume open failed:", project.id, e);
    }
  }

  createServer();
}

main().catch((e: unknown) => {
  console.error("[wapu] Fatal startup error:", e);
  process.exit(1);
});
