import { Effect } from "effect";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { db } from "../db.js";
import type { Message, MessageStep, PendingQuestion, Project, ProjectPhase } from "./schema.js";
import {
  copyWorkspace,
  deleteDeployments,
  pruneSnapshots,
  projectDir,
  writeFileAtomic,
} from "./workspace.js";

const STARTER_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>wapu</title>
</head>
<body>
  <p>Choose a style to generate this page.</p>
</body>
</html>
`;

interface ProjectRow {
  id: string;
  userId: string;
  name: string;
  slug: string;
  sessionId: string;
  isDeployed: number;
  deployVersion: number;
  createdAt: string;
  phase: string;
  design: string | null;
  pendingQuestion: string | null;
}

interface MessageRow {
  id: string;
  projectId: string;
  role: "user" | "assistant";
  content: string;
  steps: string | null;
  saved: number;
  position: number;
  createdAt: string;
}

function parseQuestion(raw: string | null): PendingQuestion | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PendingQuestion;
  } catch {
    return null;
  }
}

function rowToProject(row: ProjectRow): Project {
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    slug: row.slug,
    sessionId: row.sessionId,
    isDeployed: Boolean(row.isDeployed),
    deployVersion: row.deployVersion,
    createdAt: row.createdAt,
    phase: row.phase as ProjectPhase,
    design: row.design,
    pendingQuestion: parseQuestion(row.pendingQuestion),
  };
}

function rowToMessage(row: MessageRow): Message {
  return {
    id: row.id,
    projectId: row.projectId,
    role: row.role,
    content: row.content,
    steps: row.steps ? (JSON.parse(row.steps) as MessageStep[]) : undefined,
    saved: Boolean(row.saved),
    createdAt: row.createdAt,
  };
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function uniqueSlug(name: string): string {
  const base = slugify(name) || "project";
  const suffix = crypto.randomBytes(3).toString("hex");
  return `${base}-${suffix}`;
}

export const createProject = (userId: string, name: string, sessionId: string) =>
  Effect.tryPromise({
    try: async () => {
      const id = crypto.randomUUID();
      const slug = uniqueSlug(name);
      const createdAt = new Date().toISOString();

      await fs.mkdir(projectDir(id), { recursive: true });
      await fs.writeFile(path.join(projectDir(id), "index.html"), STARTER_HTML, "utf-8");

      db.prepare(
        `INSERT INTO projects
          (id, userId, name, slug, sessionId, isDeployed, deployVersion, createdAt, phase, design, pendingQuestion)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?, 'intake', NULL, NULL)`,
      ).run(id, userId, name, slug, sessionId, createdAt);

      return rowToProject({
        id,
        userId,
        name,
        slug,
        sessionId,
        isDeployed: 0,
        deployVersion: 0,
        createdAt,
        phase: "intake",
        design: null,
        pendingQuestion: null,
      });
    },
    catch: (e) => new Error(`createProject failed: ${e}`),
  });

export const getProject = (id: string) =>
  Effect.try({
    try: () => {
      const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as
        | ProjectRow
        | undefined;
      return row ? rowToProject(row) : null;
    },
    catch: (e) => new Error(`getProject failed: ${e}`),
  });

export const getProjectBySlug = (slug: string) =>
  Effect.try({
    try: () => {
      const row = db.prepare(`SELECT * FROM projects WHERE slug = ?`).get(slug) as
        | ProjectRow
        | undefined;
      return row ? rowToProject(row) : null;
    },
    catch: (e) => new Error(`getProjectBySlug failed: ${e}`),
  });

export const listProjects = (userId: string) =>
  Effect.try({
    try: () => {
      const rows = db
        .prepare(`SELECT * FROM projects WHERE userId = ? ORDER BY createdAt DESC`)
        .all(userId) as ProjectRow[];
      return rows.map(rowToProject);
    },
    catch: (e) => new Error(`listProjects failed: ${e}`),
  });

export const listAllProjects = () =>
  Effect.try({
    try: () => {
      const rows = db.prepare(`SELECT * FROM projects`).all() as ProjectRow[];
      return rows.map(rowToProject);
    },
    catch: (e) => new Error(`listAllProjects failed: ${e}`),
  });

export const setProjectPhase = (id: string, phase: ProjectPhase) =>
  Effect.try({
    try: () => {
      db.prepare(`UPDATE projects SET phase = ? WHERE id = ?`).run(phase, id);
    },
    catch: (e) => new Error(`setProjectPhase failed: ${e}`),
  });

export const setProjectDesign = (id: string, design: string) =>
  Effect.try({
    try: () => {
      db.prepare(`UPDATE projects SET design = ? WHERE id = ?`).run(design, id);
    },
    catch: (e) => new Error(`setProjectDesign failed: ${e}`),
  });

export const setProjectQuestion = (id: string, question: PendingQuestion | null) =>
  Effect.try({
    try: () => {
      db.prepare(`UPDATE projects SET pendingQuestion = ? WHERE id = ?`).run(
        question ? JSON.stringify(question) : null,
        id,
      );
    },
    catch: (e) => new Error(`setProjectQuestion failed: ${e}`),
  });

export const getMessages = (projectId: string) =>
  Effect.try({
    try: () => {
      const rows = db
        .prepare(`SELECT * FROM messages WHERE projectId = ? ORDER BY position ASC`)
        .all(projectId) as MessageRow[];
      return rows.map(rowToMessage);
    },
    catch: (e) => new Error(`getMessages failed: ${e}`),
  });

// The projection is rebuilt from the stored stream, so one transaction replaces
// the whole transcript: readers never see a half-deleted conversation.
export const replaceMessages = (projectId: string, messages: Message[]) =>
  Effect.try({
    try: () => {
      const insert = db.prepare(
        `INSERT INTO messages (id, projectId, role, content, steps, saved, position, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      db.transaction(() => {
        db.prepare(`DELETE FROM messages WHERE projectId = ?`).run(projectId);
        messages.forEach((message, position) => {
          insert.run(
            message.id,
            projectId,
            message.role,
            message.content,
            message.steps && message.steps.length > 0 ? JSON.stringify(message.steps) : null,
            message.saved ? 1 : 0,
            position,
            message.createdAt,
          );
        });
      })();
    },
    catch: (e) => new Error(`replaceMessages failed: ${e}`),
  });

export const readProjectFile = (id: string) =>
  Effect.tryPromise({
    try: () => fs.readFile(path.join(projectDir(id), "index.html"), "utf-8"),
    catch: (e) => new Error(`readProjectFile failed: ${e}`),
  });

export const writeProjectFile = (id: string, html: string) =>
  Effect.tryPromise({
    try: () => writeFileAtomic(path.join(projectDir(id), "index.html"), html),
    catch: (e) => new Error(`writeProjectFile failed: ${e}`),
  });

export const deleteProject = (id: string) =>
  Effect.tryPromise({
    try: async () => {
      db.prepare(`DELETE FROM messages WHERE projectId = ?`).run(id);
      db.prepare(`DELETE FROM projects WHERE id = ?`).run(id);
      await fs.rm(projectDir(id), { recursive: true, force: true });
      await deleteDeployments(id);
    },
    catch: (e) => new Error(`deleteProject failed: ${e}`),
  });

export const deployProject = (id: string) =>
  Effect.tryPromise({
    try: async () => {
      const row = db.prepare(`SELECT * FROM projects WHERE id = ?`).get(id) as
        | ProjectRow
        | undefined;
      if (!row) throw new Error("Project not found");

      if (row.isDeployed) {
        db.prepare(`UPDATE projects SET isDeployed = 0 WHERE id = ?`).run(id);
        return {
          slug: row.slug,
          isDeployed: false,
          deployVersion: row.deployVersion,
        };
      }

      const version = row.deployVersion + 1;
      await copyWorkspace(id, version);
      await pruneSnapshots(id, 5);

      db.prepare(`UPDATE projects SET isDeployed = 1, deployVersion = ? WHERE id = ?`).run(
        version,
        id,
      );

      return { slug: row.slug, isDeployed: true, deployVersion: version };
    },
    catch: (e) => new Error(`deployProject failed: ${e}`),
  });
