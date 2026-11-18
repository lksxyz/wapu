import type { IncomingMessage, ServerResponse } from "node:http";
import { Effect } from "effect";
import type { FxStreamLine, FxTurn } from "libfx";
import { auth } from "../auth.js";
import {
  createProject,
  deleteProject,
  deployProject,
  getMessages,
  getProject,
  listProjects,
  readProjectFile,
  setProjectDesign,
  setProjectPhase,
  setProjectQuestion,
  writeProjectFile,
} from "../projects/storage.js";
import type {
  Message,
  Project,
  ProjectPhase,
  ProjectWithDetails,
  PublicProject,
} from "../projects/schema.js";
import { previewUrl, deployUrl } from "../projects/preview-token.js";
import { agent, deleteSessionData } from "../ai/agent.js";
import { rebuildProjection } from "../ai/projection.js";
import { designStyles, installDesignDoc } from "../ai/design.js";
import { applyTurnLine, newTurnGate, shouldExtract } from "../ai/turn-gate.js";
import { extractHtml } from "../ai/extract-html.js";
import type { DesignStyle } from "../ai/design.js";
import { buildPrompt, intakePrompt } from "../ai/prompt.js";

// ── Helpers ───────────────────────────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
  });
}

async function getSession(req: IncomingMessage) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (v) {
      if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
      else headers.set(k, v);
    }
  }
  return auth.api.getSession({ headers }).catch(() => null);
}

function json(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

function notFound(res: ServerResponse) {
  json(res, 404, { error: "Not found" });
}

function unauthorized(res: ServerResponse) {
  json(res, 401, { error: "Unauthorized" });
}

// The session id is a capability; the browser never needs it.
function publicProject(project: Project): PublicProject {
  return {
    id: project.id,
    userId: project.userId,
    name: project.name,
    slug: project.slug,
    isDeployed: project.isDeployed,
    deployVersion: project.deployVersion,
    createdAt: project.createdAt,
  };
}

function matchPath(pattern: string, url: string): Record<string, string> | null {
  const patternParts = pattern.split("/");
  const urlParts = url.split("?")[0].split("/");
  if (patternParts.length !== urlParts.length) return null;
  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    if (patternParts[i].startsWith(":")) {
      params[patternParts[i].slice(1)] = decodeURIComponent(urlParts[i]);
    } else if (patternParts[i] !== urlParts[i]) {
      return null;
    }
  }
  return params;
}

async function ownedProject(id: string, userId: string): Promise<Project | null> {
  const project = await Effect.runPromise(
    getProject(id).pipe(Effect.catch(() => Effect.succeed(null))),
  );
  return project && project.userId === userId ? project : null;
}

async function pipeStream(
  res: ServerResponse,
  stream: ReadableStream<Uint8Array>,
  hooks?: {
    observe?: (line: FxStreamLine) => void;
    beforeEnd?: () => Promise<void>;
  },
): Promise<void> {
  const reader = stream.getReader();
  const decoder = hooks?.observe ? new TextDecoder() : null;
  let buffer = "";
  let closed = false;
  res.on("close", () => {
    closed = true;
    void reader.cancel().catch(() => {});
  });

  try {
    while (!closed) {
      const { done, value } = await reader.read();
      if (done) break;

      if (decoder && hooks?.observe) {
        buffer += decoder.decode(value, { stream: true });
        let newline = buffer.indexOf("\n");
        while (newline >= 0) {
          const raw = buffer.slice(0, newline).trim();
          buffer = buffer.slice(newline + 1);
          newline = buffer.indexOf("\n");
          if (!raw) continue;
          try {
            hooks.observe(JSON.parse(raw) as FxStreamLine);
          } catch {
            // A malformed line is the stream's problem, not the socket's.
          }
        }
      }

      if (!res.write(value)) {
        const { promise, resolve } = Promise.withResolvers<void>();
        const release = () => {
          res.off("drain", release);
          res.off("close", release);
          resolve();
        };
        res.once("drain", release);
        res.once("close", release);
        await promise;
      }
    }
  } catch (e) {
    if (!closed) console.error("[chat] stream failed:", e);
  } finally {
    if (!closed) {
      if (hooks?.beforeEnd) {
        await hooks.beforeEnd().catch((e) => console.error("[chat] finish hook failed:", e));
      }
      res.end();
    }
  }
}

// ── Main Router ───────────────────────────────────────────────────────────

export async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const url = req.url ?? "/";
  const method = req.method ?? "GET";
  const urlPath = url.split("?")[0];

  // GET /health
  if (method === "GET" && urlPath === "/health") {
    json(res, 200, { status: "ok" });
    return;
  }

  // ── Project CRUD ────────────────────────────────────────────────────────

  // GET /api/projects
  if (method === "GET" && urlPath === "/api/projects") {
    const session = await getSession(req);
    if (!session) {
      unauthorized(res);
      return;
    }

    const projects = await Effect.runPromise(
      listProjects(session.user.id).pipe(Effect.catch(() => Effect.succeed([] as Project[]))),
    );
    json(res, 200, projects.map(publicProject));
    return;
  }

  // POST /api/projects
  if (method === "POST" && urlPath === "/api/projects") {
    const session = await getSession(req);
    if (!session) {
      unauthorized(res);
      return;
    }

    const body = await readBody(req);
    let name: string;
    try {
      const parsed = JSON.parse(body) as { name?: string };
      name = (parsed.name ?? "").trim();
      if (!name) throw new Error("empty");
    } catch {
      json(res, 400, { error: "name is required" });
      return;
    }

    try {
      const sessionId = await agent.newSessionId();
      const project = await Effect.runPromise(createProject(session.user.id, name, sessionId));
      json(res, 201, publicProject(project));
    } catch (e) {
      json(res, 500, { error: String(e) });
    }
    return;
  }

  // GET /api/projects/:id
  {
    const params = matchPath("/api/projects/:id", urlPath);
    if (params && method === "GET") {
      const session = await getSession(req);
      if (!session) {
        unauthorized(res);
        return;
      }

      const project = await ownedProject(params.id, session.user.id);
      if (!project) {
        notFound(res);
        return;
      }

      await rebuildProjection(project).catch((e) =>
        console.error("[projection] rebuild failed:", e),
      );
      const messages = await Effect.runPromise(
        getMessages(project.id).pipe(Effect.catch(() => Effect.succeed([] as Message[]))),
      );

      const detail: ProjectWithDetails = {
        ...publicProject(project),
        messages,
        previewUrl: previewUrl(project.id, session.user.id),
        deployUrl: project.isDeployed ? deployUrl(project.slug) : null,
        phase: project.phase,
        design: project.design,
        pendingQuestion: project.pendingQuestion ?? null,
      };
      json(res, 200, detail);
      return;
    }
  }

  // GET /api/projects/:id/preview-url
  {
    const params = matchPath("/api/projects/:id/preview-url", urlPath);
    if (params && method === "GET") {
      const session = await getSession(req);
      if (!session) {
        unauthorized(res);
        return;
      }

      const project = await ownedProject(params.id, session.user.id);
      if (!project) {
        notFound(res);
        return;
      }

      json(res, 200, { url: previewUrl(project.id, session.user.id) });
      return;
    }
  }

  // DELETE /api/projects/:id
  {
    const params = matchPath("/api/projects/:id", urlPath);
    if (params && method === "DELETE") {
      const session = await getSession(req);
      if (!session) {
        unauthorized(res);
        return;
      }

      const project = await ownedProject(params.id, session.user.id);
      if (!project) {
        notFound(res);
        return;
      }

      await Effect.runPromise(
        deleteProject(params.id).pipe(Effect.catch(() => Effect.succeed(null))),
      );
      await agent
        .session(project.sessionId)
        .cancel()
        .catch(() => {});
      await deleteSessionData(project.sessionId).catch((e) =>
        console.error("[session] delete failed:", e),
      );
      json(res, 200, { success: true });
      return;
    }
  }

  // ── Deploy toggle ───────────────────────────────────────────────────────
  // POST /api/projects/:id/deploy
  {
    const params = matchPath("/api/projects/:id/deploy", urlPath);
    if (params && method === "POST") {
      const session = await getSession(req);
      if (!session) {
        unauthorized(res);
        return;
      }

      const project = await ownedProject(params.id, session.user.id);
      if (!project) {
        notFound(res);
        return;
      }

      try {
        const result = await Effect.runPromise(deployProject(params.id));
        json(res, 200, {
          ...result,
          url: result.isDeployed ? deployUrl(result.slug) : null,
        });
      } catch (e) {
        json(res, 500, { error: String(e) });
      }
      return;
    }
  }

  // ── Export ──────────────────────────────────────────────────────────────
  // GET /api/projects/:id/export
  {
    const params = matchPath("/api/projects/:id/export", urlPath);
    if (params && method === "GET") {
      const session = await getSession(req);
      if (!session) {
        unauthorized(res);
        return;
      }

      const project = await ownedProject(params.id, session.user.id);
      if (!project) {
        notFound(res);
        return;
      }

      const html = await Effect.runPromise(
        readProjectFile(params.id).pipe(Effect.catch(() => Effect.succeed(null))),
      );
      if (!html) {
        notFound(res);
        return;
      }

      const filename = `${project.name.replace(/[^a-z0-9]/gi, "-")}.html`;
      res.writeHead(200, {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
      });
      res.end(html);
      return;
    }
  }

  // ── Agent chat ──────────────────────────────────────────────────────────
  // POST /api/projects/:id/chat
  {
    const params = matchPath("/api/projects/:id/chat", urlPath);
    if (params && method === "POST") {
      const session = await getSession(req);
      if (!session) {
        unauthorized(res);
        return;
      }

      const project = await ownedProject(params.id, session.user.id);
      if (!project) {
        notFound(res);
        return;
      }

      const body = await readBody(req);
      let message: string;
      let answers: string[] = [];
      try {
        const parsed = JSON.parse(body) as { message?: string; answers?: unknown };
        message = (parsed.message ?? "").trim();
        if (Array.isArray(parsed.answers)) {
          answers = parsed.answers
            .filter((answer): answer is string => typeof answer === "string")
            .map((answer) => answer.trim())
            .filter(Boolean);
        }
        if (!message) throw new Error("empty");
      } catch {
        json(res, 400, { error: "message is required" });
        return;
      }

      // The person answered (or moved on): the card must not outlive this turn.
      if (project.pendingQuestion) {
        await Effect.runPromise(setProjectQuestion(project.id, null)).catch((e) =>
          console.error("[ask_user] clear failed:", e),
        );
      }

      const styles = await designStyles().catch((e) => {
        console.error("[design] menu load failed:", e);
        return [] as DesignStyle[];
      });

      let phase: ProjectPhase = project.phase;
      let design = project.design
        ? (styles.find((style) => style.slug === project.design) ?? null)
        : null;

      // The card sends its chosen labels as data. Exact match only — the server
      // never reads a design out of prose.
      const picked = styles.find((style) => answers.includes(style.title)) ?? null;
      if (picked && picked.slug !== design?.slug) {
        design = picked;
        await Effect.runPromise(setProjectDesign(project.id, picked.slug)).catch((e) =>
          console.error("[design] persist failed:", e),
        );
      }

      let intakeTurn = false;
      let instructions: string[];
      try {
        if (phase === "intake") {
          intakeTurn = true;
          instructions = [intakePrompt(design, styles)];
        } else {
          const firstBuild = phase !== "build";
          if (design) await installDesignDoc(project.id, design.doc);
          if (firstBuild) {
            await Effect.runPromise(setProjectPhase(project.id, "build"));
            phase = "build";
          }
          const current = firstBuild
            ? ""
            : await Effect.runPromise(readProjectFile(project.id)).catch(() => "");
          instructions = [buildPrompt(design, current, styles)];
        }
      } catch (e) {
        json(res, 500, { error: String(e) });
        return;
      }

      let turn: FxTurn;
      let cancelTimer: NodeJS.Timeout | undefined;
      try {
        const fxSession = agent.session(project.sessionId, {
          context: {
            projectId: project.id,
            userId: session.user.id,
            phase,
          },
          instructions,
        });
        turn = fxSession.prompt(message);
        await turn.accepted;
        cancelTimer = setTimeout(
          () => {
            void fxSession.cancel().catch(() => {});
          },
          Number(process.env.TURN_TIMEOUT_MS ?? 900_000),
        );
      } catch (e) {
        clearTimeout(cancelTimer);
        json(res, 500, { error: String(e) });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      const gate = newTurnGate();
      await pipeStream(res, turn.readable, {
        observe: (line) => {
          applyTurnLine(gate, line);
          // The card is the whole intake turn. Stop the model here instead of
          // letting it spend more calls — and a doomed write_file — after it.
          if (intakeTurn && line.type === "tool_end" && line.name === "ask_user" && !line.isError) {
            void agent
              .session(project.sessionId)
              .cancel()
              .catch((e) => console.error("[intake] stop failed:", e));
          }
        },
        beforeEnd: async () => {
          // A stream that failed, was cancelled, or never ended can still carry
          // a closed html fence from a partial reply. Only `end_turn` tells us
          // the reply is whole; everything else leaves the page as it was.
          if (!shouldExtract(gate, intakeTurn)) return;
          const html = extractHtml(gate.reply);
          if (!html) return;
          await Effect.runPromise(writeProjectFile(project.id, html));
        },
      });

      const outcome = await turn.result.catch(() => null);
      clearTimeout(cancelTimer);
      // The cancelled stop is this route's own doing: the question is on the
      // card, so the intake is answered and the next turn may build.
      if (intakeTurn && (gate.asked || outcome?.stopReason === "end_turn")) {
        await Effect.runPromise(setProjectPhase(project.id, "intake_asked")).catch((e) =>
          console.error("[intake] phase update failed:", e),
        );
      }
      return;
    }
  }

  // GET /api/projects/:id/stream?cursor=N
  {
    const params = matchPath("/api/projects/:id/stream", urlPath);
    if (params && method === "GET") {
      const session = await getSession(req);
      if (!session) {
        unauthorized(res);
        return;
      }

      const project = await ownedProject(params.id, session.user.id);
      if (!project) {
        notFound(res);
        return;
      }

      const cursorParam = new URL(url, "http://localhost").searchParams.get("cursor");
      const cursor = cursorParam ? Number(cursorParam) : 0;
      if (!Number.isInteger(cursor) || cursor < 0) {
        json(res, 400, { error: "cursor must be a non-negative integer" });
        return;
      }

      let stream: ReadableStream<Uint8Array>;
      try {
        stream = agent.session(project.sessionId).stream(cursor);
      } catch (e) {
        json(res, 500, { error: String(e) });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });
      res.flushHeaders();
      await pipeStream(res, stream);
      return;
    }
  }

  // POST /api/projects/:id/stop
  {
    const params = matchPath("/api/projects/:id/stop", urlPath);
    if (params && method === "POST") {
      const session = await getSession(req);
      if (!session) {
        unauthorized(res);
        return;
      }

      const project = await ownedProject(params.id, session.user.id);
      if (!project) {
        notFound(res);
        return;
      }

      await agent
        .session(project.sessionId)
        .cancel()
        .catch(() => {});
      json(res, 200, { success: true });
      return;
    }
  }

  notFound(res);
}
