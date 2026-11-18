import fs from "node:fs/promises";
import path from "node:path";
import { Effect } from "effect";
import type { FxAgentHostTool, FxToolContext } from "libfx";
import { realProjectDir, writeFileAtomic } from "../projects/workspace.js";
import { setProjectQuestion } from "../projects/storage.js";
import type { AskedQuestion, PendingQuestion } from "../projects/schema.js";
import crypto from "node:crypto";

const MAX_FILES = 64;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_PROJECT_BYTES = 16 * 1024 * 1024;
const MAX_READ_BYTES = 60 * 1024;

interface WorkspaceFile {
  path: string;
  bytes: number;
}

async function listWorkspace(root: string): Promise<WorkspaceFile[]> {
  const files: WorkspaceFile[] = [];

  async function walk(dir: string, prefix: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isSymbolicLink()) continue;
      const absolute = path.join(dir, entry.name);
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(absolute, relative);
        continue;
      }
      if (!entry.isFile()) continue;
      const stat = await fs.stat(absolute);
      files.push({ path: relative, bytes: stat.size });
      if (files.length > MAX_FILES) {
        throw new Error(
          `Workspace has more than ${MAX_FILES} files. Remove or merge files before adding more.`,
        );
      }
    }
  }

  await walk(root, "");
  return files;
}

function contextProjectId(context: FxToolContext): string {
  const value = context.context;
  if (!value || typeof value !== "object" || Array.isArray(value) || !("projectId" in value)) {
    throw new Error("Missing project context for workspace tool");
  }
  if (typeof value.projectId !== "string" || value.projectId.length === 0) {
    throw new Error("Missing project context for workspace tool");
  }
  return value.projectId;
}

function normalizeRelative(input: unknown): string {
  if (typeof input !== "string" || input.trim().length === 0) {
    throw new Error("A non-empty file path is required");
  }
  if (input.includes("\0")) throw new Error("Invalid file path");

  const normalized = path.posix.normalize(input.replace(/\\/g, "/"));
  if (normalized === ".." || normalized.startsWith("../") || path.posix.isAbsolute(normalized)) {
    throw new Error("Path escapes the project workspace");
  }
  return normalized;
}

async function resolveWorkspacePath(
  projectId: string,
  relative: string,
): Promise<{ root: string; target: string }> {
  const root = await realProjectDir(projectId);
  const target = path.resolve(root, relative);
  if (target === root) throw new Error("A file path is required");
  if (target !== root && !target.startsWith(root + path.sep)) {
    throw new Error("Path escapes the project workspace");
  }

  try {
    const stat = await fs.lstat(target);
    if (stat.isSymbolicLink()) throw new Error("Symlinks are not allowed");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  // Reject a parent symlink even when the target file does not exist yet.
  let parent = path.dirname(target);
  while (parent !== root) {
    try {
      const stat = await fs.lstat(parent);
      if (stat.isSymbolicLink()) throw new Error("Symlinks are not allowed");
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      parent = path.dirname(parent);
    }
  }
  const realParent = await fs.realpath(parent);
  if (realParent !== root && !realParent.startsWith(root + path.sep)) {
    throw new Error("Path escapes the project workspace");
  }

  return { root, target };
}

const listFiles: FxAgentHostTool = {
  name: "list_files",
  description:
    "List every file in the project workspace with its size in bytes. Call this before reading or rewriting a project you did not just create.",
  inputSchema: {
    type: "object",
    properties: {},
    additionalProperties: false,
  },
  idempotent: true,
  async execute(_input, context) {
    const projectId = contextProjectId(context);
    const root = await realProjectDir(projectId);
    const files = await listWorkspace(root);
    const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
    return { files, totalBytes };
  },
};

const readFile: FxAgentHostTool = {
  name: "read_file",
  description:
    "Read one UTF-8 text file from the project workspace. Files larger than 60 KiB cannot be read in one call.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Workspace-relative path" },
    },
    required: ["path"],
    additionalProperties: false,
  },
  idempotent: true,
  async execute(input: { path?: unknown }, context) {
    const projectId = contextProjectId(context);
    const relative = normalizeRelative(input.path);
    const { target } = await resolveWorkspacePath(projectId, relative);
    const stat = await fs.stat(target);
    if (!stat.isFile()) throw new Error("Not a file");
    if (stat.size > MAX_READ_BYTES) {
      throw new Error(
        `File is ${stat.size} bytes; one read is limited to ${MAX_READ_BYTES} bytes.`,
      );
    }
    return fs.readFile(target, "utf-8");
  },
};

const writeFile: FxAgentHostTool = {
  name: "write_file",
  description:
    "Write a complete UTF-8 text file to the project workspace. Every write replaces the whole file; read first if you need its existing content. index.html is the preview entry point.",
  inputSchema: {
    type: "object",
    properties: {
      path: { type: "string", description: "Workspace-relative path" },
      content: { type: "string", description: "Complete file content" },
    },
    required: ["path", "content"],
    additionalProperties: false,
  },
  idempotent: true,
  writes: true,
  async execute(input: { path?: unknown; content?: unknown }, context) {
    const projectId = contextProjectId(context);
    const ctx = context.context;
    const phase =
      ctx && typeof ctx === "object" && !Array.isArray(ctx) && "phase" in ctx
        ? ctx.phase
        : undefined;
    if (phase !== undefined && phase !== "build") {
      throw new Error(
        "This project is still in intake. Ask the clarifying questions; write_file is unavailable until the person answers.",
      );
    }
    const relative = normalizeRelative(input.path);
    if (typeof input.content !== "string") {
      throw new Error("content must be a string");
    }

    const bytes = Buffer.byteLength(input.content, "utf-8");
    if (bytes > MAX_FILE_BYTES) {
      throw new Error(`File is ${bytes} bytes; the per-file limit is ${MAX_FILE_BYTES} bytes.`);
    }

    const { root, target } = await resolveWorkspacePath(projectId, relative);
    const files = await listWorkspace(root);
    const existing = files.find((file) => file.path === relative);
    const nextCount = files.length + (existing ? 0 : 1);
    const nextBytes =
      files.reduce((sum, file) => sum + file.bytes, 0) - (existing?.bytes ?? 0) + bytes;

    if (nextCount > MAX_FILES) {
      throw new Error(`Project is limited to ${MAX_FILES} files.`);
    }
    if (nextBytes > MAX_PROJECT_BYTES) {
      throw new Error(`Project is limited to ${MAX_PROJECT_BYTES} bytes in total.`);
    }

    await fs.mkdir(path.dirname(target), { recursive: true });
    await writeFileAtomic(target, input.content);

    return { ok: true, path: relative, bytes };
  },
};

// Questions with tappable answers. The store holds them, not the stream, so a
// reload still shows the same card; the next chat turn clears it.
const askUser: FxAgentHostTool = {
  name: "ask_user",
  description:
    "Ask the person 1 to 4 questions, each with 2 to 6 tappable answers. The card shows one question at a time with their own words allowed, so ask everything you need in one call instead of writing questions in prose. End your turn after calling it; the answers arrive as one message.",
  inputSchema: {
    type: "object",
    properties: {
      questions: {
        type: "array",
        description: "1 to 4 questions, in the order they should be asked.",
        items: {
          type: "object",
          properties: {
            question: {
              type: "string",
              description: "One sentence, ending with a question mark.",
            },
            options: {
              type: "array",
              description: "2 to 6 short answers, each a few words.",
              items: { type: "string" },
            },
          },
          required: ["question", "options"],
          additionalProperties: false,
        },
      },
    },
    required: ["questions"],
    additionalProperties: false,
  },
  idempotent: false,
  async execute(input, context) {
    const projectId = contextProjectId(context);
    const pending = readQuestions(input);
    await Effect.runPromise(setProjectQuestion(projectId, pending)).catch((e) =>
      console.error("[ask_user] persist failed:", e),
    );
    return { asked: true, questions: pending.questions.map((q) => q.question) };
  },
};

function readQuestions(input: unknown): PendingQuestion {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("ask_user needs questions");
  }
  const raw = "questions" in input ? input.questions : undefined;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > 4) {
    throw new Error("ask_user needs between 1 and 4 questions");
  }
  const questions = raw.map((entry: unknown): AskedQuestion => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error("each asked question needs a question and options");
    }
    const question = "question" in entry ? entry.question : undefined;
    const options = "options" in entry ? entry.options : undefined;
    if (typeof question !== "string" || !question.trim()) {
      throw new Error("each asked question needs a question");
    }
    if (!Array.isArray(options)) throw new Error("each asked question needs options");
    const clean = options
      .filter((option): option is string => typeof option === "string")
      .map((option) => option.trim())
      .filter(Boolean);
    const unique = [...new Set(clean)];
    if (unique.length < 2 || unique.length > 6) {
      throw new Error("each asked question needs between 2 and 6 options");
    }
    return { question: question.trim(), options: unique };
  });
  return { id: crypto.randomUUID(), questions };
}

export const fileTools: FxAgentHostTool[] = [listFiles, readFile, writeFile, askUser];
